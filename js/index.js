let map;
let infowindow;
let autocomplete;

// 初始化 Google Map
window.initMap = function() {
    const taipei = new google.maps.LatLng(25.0330, 121.5654);
    map = new google.maps.Map(document.getElementById("map"), {
        center: taipei,
        zoom: 15,
    });

    infowindow = new google.maps.InfoWindow();

    autocomplete = new google.maps.places.Autocomplete(
        document.getElementById('location'), { types: ['geocode'] }
    );

    autocomplete.addListener('place_changed', () => {
        infowindow.close();
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            window.alert("No details available for input: '" + place.name + "'");
            return;
        }
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }
        infowindow.setContent('<div><strong>' + place.name + '</strong><br>' +
            'Place ID: ' + place.place_id + '<br>' +
            place.formatted_address);
        infowindow.open(map);
    });

      // 监听表单提交事件
      document.querySelector('form').addEventListener('submit', function (event) {
        event.preventDefault();
        clearErrors();

        const gazeScoreValue = parseInt(document.getElementById('gaze-score').value) || 0;
        const facialScoreValue = parseInt(document.getElementById('facial-score').value) || 0;
        const armScoreValue = parseInt(document.getElementById('arm-score').value) || 0;
        const speechScoreValue = parseInt(document.getElementById('speech-score').value) || 0;
        const cpssScoreValue = facialScoreValue + armScoreValue + speechScoreValue;
        let onsetTimeValue = document.getElementById('onset-time').value;
        
        // 固定的出發地點「臺北市松山區八德路三段12巷16弄6號」，原本是const locationValue = document.getElementById('location').value;
        const locationValue = "臺北市松山區八德路三段12巷16弄6號";

        const isValid = validateForm(gazeScoreValue, facialScoreValue, armScoreValue, speechScoreValue, onsetTimeValue, locationValue);
        if (!isValid) return;

        onsetTimeValue = onsetTimeValue.replace("T", " ") + ":00";

        console.log('Calculating results with fixed origin:', {
            'cpss-score': cpssScoreValue,
            'onset-time': onsetTimeValue,
            'location': locationValue,
        });

        document.getElementById('loading').style.display = 'block';

        // 调用 calculateResults
        calculateResults(cpssScoreValue, onsetTimeValue, locationValue)
            .then(displayResults)
            .catch(error => {
                document.getElementById('loading').style.display = 'none';
                console.error('Error:', error);
            });
        
     });
        // 如果要改成定位用戶的話會用到
        document.getElementById('locate-btn').addEventListener('click', function() {
        locateUser();
        });
    
}

// 使用 Google Maps API 計算駕駛時間
function calculateGoogleMapsTime(origin, destination) {
    return new Promise((resolve, reject) => {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route({
            origin: origin,
            destination: destination,
            travelMode: 'DRIVING',
            drivingOptions: {
                departureTime: new Date(),  // 当前时间
                trafficModel: 'bestguess'
            }
        }, (response, status) => {
            if (status === 'OK' && response.routes.length > 0) {
                const leg = response.routes[0].legs[0];
                resolve(leg.duration_in_traffic ? leg.duration_in_traffic.value : null);
            } else {
                console.error("Error calculating time: " + status);  // 打印错误信息
                reject("Error calculating time: " + status);
            }
        });
    });
}



function locateUser() {
    // 設置固定的出發地點為「臺北市松山區八德路三段12巷16弄6號」
    const fixedAddress = "臺北市松山區八德路三段12巷16弄6號";

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': fixedAddress }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const fixedLocation = results[0].geometry.location;
            map.setCenter(fixedLocation);  // 將地圖中心設置為固定的地點
            map.setZoom(17);  // 設置縮放級別

            infowindow.setContent(results[0].formatted_address);
            infowindow.open(map);

            // 更新輸入框中的地址
            document.getElementById('location').value = results[0].formatted_address;
        } else {
            window.alert('Geocoder failed due to: ' + status);
        }
    });
}

function handleLocationError(browserHasGeolocation, pos) {
    infowindow.setPosition(pos);
    infowindow.setContent(browserHasGeolocation ?
        'Error: The Geolocation service failed.' :
        'Error: Your browser doesn\'t support geolocation.');
    infowindow.open(map);
}

document.addEventListener('DOMContentLoaded', function() {
    const gazeScore = document.getElementById('gaze-score');
    const facialScore = document.getElementById('facial-score');
    const armScore = document.getElementById('arm-score');
    const speechScore = document.getElementById('speech-score');
    const totalScoreElement = document.getElementById('total-score');

    console.log('gazeScore:', gazeScore);
    console.log('facialScore:', facialScore);
    console.log('armScore:', armScore);
    console.log('speechScore:', speechScore);

    function updateTotalScore() {
        // 取得 gaze deviation 的分數，如果是 abnormal，則為 2 分
        const gazeScoreValue = (parseInt(gazeScore.value) === 1) ? 2 : 0;
        // 計算其他項目的總分
        const totalScore = 
            gazeScoreValue +
            (parseInt(facialScore.value) || 0) +
            (parseInt(armScore.value) || 0) +
            (parseInt(speechScore.value) || 0);
        totalScoreElement.textContent = totalScore;
    }

    gazeScore.addEventListener('change', updateTotalScore);
    facialScore.addEventListener('change', updateTotalScore);
    armScore.addEventListener('change', updateTotalScore);
    speechScore.addEventListener('change', updateTotalScore);
});

function erf(x) {
    // 使用 Abramowitz 和 Stegun 的公式來近似計算誤差函數
    const sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);

    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
}

// 計算正態分佈的累積分佈函數 (CDF)
function normCdf(z) {
    return (1.0 + erf(z / Math.sqrt(2))) / 2.0; // 使用自定义的 erf 函数
}
// 計算截尾常態分佈的概率
function calculateTruncatedNormal(lowerBound, mean, variance, threshold) {
    const sd = Math.sqrt(variance); // 标准差
    const zLower = (lowerBound - mean) / sd; // z分数下界
    const zThreshold = (threshold - mean) / sd; // z分数阈值
    const prob1 = normCdf(zLower); // 下界的累积分布函数值
    const prob2 = normCdf(zThreshold); // 阈值的累积分布函数值
    return (prob2 - prob1) / (1 - prob1); // 计算截尾常态分布的概率
}

// 计算症状发生到当前的时间差的函数
function calculatePretransportTime(onsetTime) {
    const currentTime = new Date();
    const onsetDate = new Date(onsetTime);
    return Math.floor((currentTime - onsetDate) / 1000);  // 时间差转换为秒
}

// 计算 p_nLVO 值的函数
function calculatePNLVO(cpssScore) {
    let p_nLVO;
    switch (cpssScore) {
        case 5: p_nLVO = 1; break;
        case 4: p_nLVO = 0.9714; break;
        case 3: p_nLVO = 0.7317; break;
        case 2: p_nLVO = 0.6111; break;
        case 1: p_nLVO = 0.4615; break;
        default: p_nLVO = null;
    }
    return p_nLVO;
}
// 計算結果
async function calculateResults(cpssScore, onsetTime, origin) {
    const destinations = [
        "馬偕紀念醫院",
        "萬芳醫院",
        "三軍總醫院松山分院",
        "臺北市立聯合醫院仁愛院區",
        "三軍總醫院",
        "國立台灣大學醫學院附設醫院急診部",
        "臺北榮民總醫院",
        "台北醫學大學附設醫院",
        "新光吳火獅紀念醫院",
        "國泰綜合醫院急診室"
    ];

    // 计算症状发生到当前的时间差
    const pretransportTime = calculatePretransportTime(onsetTime);

    // 获取所有目的地的交通时间
    const googleMapsTimes = await Promise.all(
        destinations.map(destination => calculateGoogleMapsTime(origin, destination))
    );
    
    // 计算 p_nLVO 值
    const p_nLVO = calculatePNLVO(cpssScore);

    
    let currentTime = new Date();
    let pretransport_time = Math.floor((currentTime - new Date(onsetTime)) / 1000);

    let hospitals = [
        {
            'name': "馬偕紀念醫院",
            'prehospital_time':pretransport_time + googleMapsTimes[0],
            'lower_bound': pretransport_time + googleMapsTimes[0] + 0 + p_nLVO * 420 + (1 - p_nLVO) * (2790 + 360 + 1680),
            'mean': pretransport_time + googleMapsTimes[0] + 1020 + p_nLVO * 2340 + (1 - p_nLVO) * (2790 + 360 + 6846),
            'variance': 288**2 + ((p_nLVO)**2) * (1167**2) + ((1 - p_nLVO)**2) * (3287**2)
        },
        {
            'name': "萬芳醫院",
            'prehospital_time':pretransport_time + googleMapsTimes[1],
            'lower_bound': pretransport_time + googleMapsTimes[1] + 0 + p_nLVO * 1140 + (1 - p_nLVO) * (2790 + 1020 + 1680),
            'mean': pretransport_time + googleMapsTimes[1] + 1200 + p_nLVO * 2250 + (1 - p_nLVO) * (2790 + 1020 + 6846),
            'variance': 244**2 + ((p_nLVO)**2) * (675**2) + ((1 - p_nLVO)**2) * (3287**2)
        },
        {
            'name': "三軍總醫院松山分院",
            'prehospital_time':pretransport_time + googleMapsTimes[2],
            'lower_bound': pretransport_time + googleMapsTimes[2] + 120 + p_nLVO * 1142 + (1 - p_nLVO) * (2790 + 960 + 1680),
            'mean': pretransport_time + googleMapsTimes[2] + 1380 + p_nLVO * 2517 + (1 - p_nLVO) * (2790 + 960 + 6846),
            'variance': 459**2 + ((p_nLVO)**2) * (836**2) + ((1 - p_nLVO)**2) * (3287**2)
        },
        {
            'name': "臺北市立聯合醫院仁愛院區",
            'prehospital_time':pretransport_time + googleMapsTimes[3],
            'lower_bound': pretransport_time + googleMapsTimes[3] + 120 + p_nLVO * 1142 + (1 - p_nLVO) * (2790 + 420 + 1680),
            'mean': pretransport_time + googleMapsTimes[3] + 1380 + p_nLVO * 2517 + (1 - p_nLVO) * (2790 + 420 + 6846),
            'variance': 282**2 + ((p_nLVO)**2) * (836**2) + ((1 - p_nLVO)**2) * (3287**2)  
        },
        {
            'name': "三軍總醫院",
            'prehospital_time':pretransport_time + googleMapsTimes[4],
            'lower_bound': pretransport_time + googleMapsTimes[4] + p_nLVO * (0 + 360) + (1 - p_nLVO) * 5400,
            'mean': pretransport_time + googleMapsTimes[4] + p_nLVO * (480 + 2940) + (1 - p_nLVO) * 8780,
            'variance': ((p_nLVO)**2) * ( 244**2 + 1568**2) +((1 - p_nLVO) **2) * ( 3183**2 )
        },
        {
            'name': "國立台灣大學醫學院附設醫院急診部",
            'prehospital_time':pretransport_time + googleMapsTimes[5],
            'lower_bound': pretransport_time + googleMapsTimes[5] + p_nLVO * (60 + 600) + (1 - p_nLVO) * 1680,
            'mean': pretransport_time + googleMapsTimes[5] + p_nLVO * (900 + 2070) + (1 - p_nLVO) * 6846,
            'variance': ((p_nLVO)**2) * ( 319**2 + 894**2) +((1 - p_nLVO) **2) * ( 3287**2 ) 
        },
        {
            'name': "臺北榮民總醫院",
            'prehospital_time':pretransport_time + googleMapsTimes[6],
            'lower_bound': pretransport_time + googleMapsTimes[6] + p_nLVO * (0 + 120) + (1 - p_nLVO) * 2580,
            'mean': pretransport_time + googleMapsTimes[6] + p_nLVO * (900 + 1980) + (1 - p_nLVO) * 6284,
            'variance': ((p_nLVO)**2) * ( 399**2 + 1131**2) +((1 - p_nLVO) **2) * ( 2318**2 ) 
        },
        {
            'name': "台北醫學大學附設醫院",
            'prehospital_time':pretransport_time + googleMapsTimes[7],
            'lower_bound': pretransport_time + googleMapsTimes[7] + p_nLVO * (0 + 900) + (1 - p_nLVO) * 5520,
            'mean': pretransport_time + googleMapsTimes[7] + p_nLVO * (1020 + 2160) + (1 - p_nLVO) * 12358,
            'variance': ((p_nLVO)**2) * ( 343**2 + 766**2) +((1 - p_nLVO) **2 )* ( 5290**2 ) 
        },
        {
            'name': "新光吳火獅紀念醫院",
            'prehospital_time':pretransport_time + googleMapsTimes[8],
            'lower_bound': pretransport_time + googleMapsTimes[8] + p_nLVO * (0 + 1140) + (1 - p_nLVO) * 5400,
            'mean': pretransport_time + googleMapsTimes[8] + p_nLVO * (1140 + 2520) + (1 - p_nLVO) * 8780,
            'variance': ((p_nLVO)**2) * ( 355**2 + 839**2) +((1 - p_nLVO) **2) * ( 3183**2 ) 
        },
        {
            'name': "國泰綜合醫院急診室",
            'prehospital_time':pretransport_time + googleMapsTimes[9],
            'lower_bound': pretransport_time + googleMapsTimes[9] + p_nLVO * (180 + 1080) + (1 - p_nLVO) * 6900,
            'mean': pretransport_time + googleMapsTimes[9] + p_nLVO * (1500 + 2880) + (1 - p_nLVO) * 10638,
            'variance': ((p_nLVO)**2) * ( 356**2 + 1094**2) +((1 - p_nLVO) **2) * ( 3244**2 ) 
        }
    ];

    for (let hospital of hospitals) {
        hospital['probability'] = calculateTruncatedNormal(
            hospital['lower_bound'], hospital['mean'], hospital['variance'], 3.75 * 60 * 60
        );
        hospital['google_map_url'] = generateGoogleMapLink(hospital['name']);
    }

    return hospitals.sort((a, b) => b.probability - a.probability).slice(0, 5);
}

// 生成 Google 地圖鏈接
function generateGoogleMapLink(hospitalName) {
    let encodedHospitalName = encodeURIComponent(hospitalName);
    return `https://www.google.com/maps/search/?api=1&query=${encodedHospitalName}`;
}

// 顯示計算結果
function displayResults(hospitals) {
    document.getElementById('loading').style.display = 'none';

    const topHospitalsContainer = document.getElementById('topHospitals');
    topHospitalsContainer.innerHTML = '';

    const criticalMessageContainer = document.getElementById('critical-message-container');
    criticalMessageContainer.innerHTML = '';

    const criticalMessage = document.createElement('div');
    criticalMessage.classList.add('critical-message');
    criticalMessage.innerText = "患者情況危急，需要立即住院治療！";
    criticalMessageContainer.appendChild(criticalMessage);

    hospitals.forEach(hospital => {
        const roundedProbability = (hospital.probability).toFixed(3);
        const meanMinutes = (hospital.mean / 60).toFixed(3);
        

        // 創建每個醫院的卡片
        const hospitalElement = document.createElement('div');
        hospitalElement.classList.add('hospital-card');
        const mapId = `hospital-map-${hospital.name.replace(/\s/g, '-')}`;
        const chartId = `chart-${hospital.name.replace(/\s/g, '-')}`;

        hospitalElement.innerHTML = `
            <h3>${hospital.name}</h3>
            <p><strong>接受明確治療的機率:</strong> ${roundedProbability}</p>
            <p><strong>從症狀出現到接受明確治療的平均時間:</strong> ${meanMinutes} minutes</p>
            <button onclick="window.open('${hospital.google_map_url}', '_blank')">前往地圖</button>
            <div id="${mapId}" class="hospital-map" style="height: 200px;"></div>
            <canvas id="${chartId}" width="400" height="200"></canvas>
        `;
        topHospitalsContainer.appendChild(hospitalElement);

        // 初始化每個醫院的地圖
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ 'address': hospital.name }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const hospitalLatLng = results[0].geometry.location;
                const hospitalMap = new google.maps.Map(document.getElementById(mapId), {
                    center: hospitalLatLng,
                    zoom: 15,
                });
                new google.maps.Marker({
                    position: hospitalLatLng,
                    map: hospitalMap,
                    title: hospital.name,
                });
            } else {
                console.error('Geocode was not successful for the following reason: ' + status);
            }
        });

        function convertCanvasToBase64(canvasId) {
            // 获取 canvas 元素
            const canvas = document.getElementById(canvasId);
        
            // 如果找到 canvas 元素
            if (canvas) {
                // 使用 toDataURL 方法将 canvas 转换为 base64
                return canvas.toDataURL("image/png").replace("data:image/png;base64,", "");
            } else {
                console.error(`Canvas with id ${canvasId} not found.`);
                return null; // 如果找不到 canvas 元素，返回 null
            }
        }
        
        // 调用 createChart 函数来绘制图表
        createChart(chartId, hospital);
    
        // 图表绘制后，将其转换为 Base64
        const imgBase64 = convertCanvasToBase64(chartId);
    
        if (imgBase64) {
        console.log(imgBase64);  // 你可以将这个 Base64 编码的字符串用于其他目的，比如发送给服务器
        }
    });
}
// 绘制常态分布图函数
function createChart(canvasId, hospital) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas with id ${canvasId} not found.`);
        return;  // 退出函数，防止错误
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context not found.');
        return;
    }

    // 定义截尾常態分布数据
    const mean = hospital.mean / 60; // 将秒转换为分钟
    const sd = Math.sqrt(hospital.variance) / 60;
    const lowerBound = hospital.lower_bound / 60;
    const threshold = 3.75 * 60; // 3.75 小时的阈值
    const prehospitalTimeMinutes = hospital.prehospital_time / 60;

    // 生成 X 和 Y 轴数据
    const xValues = [];
    const yValues = [];
    const fillArea = [];

    // 从 mean - 4*sd 到 mean + 4*sd 生成数据点
    for (let x = mean - 4 * sd; x <= mean + 4 * sd; x += 0.1) {
        const y = jStat.normal.pdf(x, mean, sd);
        xValues.push(x);
        yValues.push(y);
        
        // 标记截尾部分的区域
        if (x >= lowerBound - prehospitalTimeMinutes && x < threshold - prehospitalTimeMinutes) {
            fillArea.push(y);
        } else {
            fillArea.push(null);
        }
    }

    // 创建Chart.js图表
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: xValues,
            datasets: [{
                label: 'Probability Density Function',
                data: yValues,
                borderColor: 'black',
                fill: false,
                tension: 0.1
            }, {
                label: 'Truncated Area',
                data: fillArea,
                backgroundColor: 'rgba(128, 128, 128, 0.5)',
                borderColor: 'rgba(128, 128, 128, 0.5)',
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Mean time from hospital arrival to definitive treatment (minutes)',
                        font: {
                            family: 'Times New Roman',
                            size: 8
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            // 只显示这些坐标 0, 75, 100, 125, 150, 175, 200, 225
                            if ([0, 75, 100, 125, 150, 175, 200, 225].includes(value)) {
                                return value;
                            }
                            return null;  // 隐藏其他坐标
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Probability',
                        font: {
                            family: 'Times New Roman',
                            size: 8
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            family: 'Times New Roman',
                            size: 8
                        }
                    }
                }
            }
        }
    });
}
  
    
/* Change color of dropdowns based on selection */
var elements = ['gaze-score','facial-score', 'arm-score', 'speech-score'];

elements.forEach(function(id) {
    document.getElementById(id).addEventListener('change', function() {
        this.style.color = this.value === "" ? '#ccc' : '#000';
    });
});

function validateForm(gazeScore, facialScore, armScore, speechScore, onsetTime, location) {
    let isValid = true;

    console.log('gazeScore:', gazeScore);
    console.log('facialScore:', facialScore);
    console.log('armScore:', armScore);
    console.log('speechScore:', speechScore);
    console.log('onsetTime:', onsetTime);
    console.log('location:', location);

    if (facialScore === 0 && armScore === 0 && speechScore === 0) {
        isValid = false;
        showError('gaze-score', 'Please select gaze status.');
        showError('facial-score', 'Please select facial status.');
        showError('arm-score', 'Please select arm status.');
        showError('speech-score', 'Please select speech status.');
        document.getElementById('facial-score').scrollIntoView({ behavior: 'smooth' });
    }
    if (onsetTime === '') {
        isValid = false;
        showError('onset-time', 'Please select onset time.');
        document.getElementById('onset-time').scrollIntoView({ behavior: 'smooth' });
    }
    if (location === '') {
        isValid = false;
        showError('location', 'Please enter location.');
        document.getElementById('location').scrollIntoView({ behavior: 'smooth' });
    }
    return isValid;
}

function showError(elementId, message) {
    document.getElementById(`${elementId}-error`).innerText = message;
}

function clearErrors() {
    document.getElementById('gaze-score-error').innerText = '';
    document.getElementById('facial-score-error').innerText = '';
    document.getElementById('arm-score-error').innerText = '';
    document.getElementById('speech-score-error').innerText = '';
    document.getElementById('onset-time-error').innerText = '';
    document.getElementById('location-error').innerText = '';
}




navigator.geolocation.getCurrentPosition(successCallback, errorCallback);

function errorCallback(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            alert("用戶拒絕了地理定位請求。");
            break;
        case error.POSITION_UNAVAILABLE:
            alert("無法獲取位置。");
            break;
        case error.TIMEOUT:
            alert("請求超時。");
            break;
        case error.UNKNOWN_ERROR:
            alert("未知錯誤。");
            break;
    }
}
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
}
function successCallback(position) {
    console.log('Latitude: ' + position.coords.latitude);
    console.log('Longitude: ' + position.coords.longitude);
}

function errorCallback(error) {
    console.error('Error occurred. Error code: ' + error.code);
}

