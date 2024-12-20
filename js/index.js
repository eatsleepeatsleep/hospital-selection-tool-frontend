let map;
let infowindow;
let autocomplete;

window.initMap = function () {
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

    document.querySelector('form').addEventListener('submit', function (event) {
        event.preventDefault();
        clearErrors();

        //const gazeScoreValue = parseInt(document.getElementById('gaze-score').value) || 0;
        const gazeScoreValue = (parseInt(document.getElementById('gaze-score').value) === 1) ? 2 : 0;
        const facialScoreValue = parseInt(document.getElementById('facial-score').value) || 0;
        const armScoreValue = parseInt(document.getElementById('arm-score').value) || 0;
        const speechScoreValue = parseInt(document.getElementById('speech-score').value) || 0;
        const cpssScoreValue = gazeScoreValue + facialScoreValue + armScoreValue + speechScoreValue;
        let onsetTimeValue = document.getElementById('onset-time').value;
        const locationValue = document.getElementById('location').value;

        const isValid = validateForm(gazeScoreValue, facialScoreValue, armScoreValue, speechScoreValue, onsetTimeValue, locationValue);
        if (!isValid) return;

        onsetTimeValue = onsetTimeValue.replace("T", " ") + ":00";

        console.log('Sending data to backend:', {
            'cpss-score': cpssScoreValue,
            'onset-time': onsetTimeValue,
            'location': locationValue,
        });

        document.getElementById('loading').style.display = 'block';

        fetch('https://hospital-selection-tool-backend.onrender.com/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'cpss-score': cpssScoreValue,
                'onset-time': onsetTimeValue,
                'location': locationValue,
            }),
            mode: 'cors' // 確保使用 CORS 模式
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                document.getElementById('loading').style.display = 'none';
                console.log('Response data:', data);

                const topHospitalsContainer = document.getElementById('topHospitals');
                topHospitalsContainer.innerHTML = '';

                const criticalMessageContainer = document.getElementById('critical-message-container');
                criticalMessageContainer.innerHTML = '';

                const criticalMessage = document.createElement('div');
                criticalMessage.classList.add('critical-message');
                criticalMessage.innerText = "患者情況緊急，需要立即送醫";
                criticalMessageContainer.appendChild(criticalMessage);

                data.top_hospitals.forEach(hospital => {
                    const truncatedProbability = Math.floor(hospital.probability * 100000) / 1000 + '%';
                    const meanMinutes = (hospital.mean / 60).toFixed(3);
                    const lowerboundMinutes = (hospital.lower_bound / 60).toFixed(3);
                    const googlemapstime = (hospital. google_maps_time / 60).toFixed(3);

                    const hospitalElement = document.createElement('div');
                    hospitalElement.classList.add('hospital-card');
                    hospitalElement.innerHTML = `
                        <h3>${hospital.priority}：${hospital.name}</h3>
                        <p><strong>患者接受正確治療的機率：</strong> ${truncatedProbability}</p>
                        <p><strong>從病發到接受正確治療的平均時間：</strong> ${Math.round(meanMinutes)} 分鐘</p>
                        <p><strong>預期最快可接受正確治療的時間：</strong> ${Math.round(lowerboundMinutes)} 分鐘</p>
                        <p><strong>前往醫院的車程時間：</strong> ${Math.round(googlemapstime)} 分鐘</p>
                        <button onclick="window.open('${hospital.google_map_url}', '_blank')">前往地圖</button>
                        <div id="hospital-map-${hospital.name.replace(/\s/g, '-')}" class="hospital-map"></div>
                        <img src="data:image/png;base64,${hospital.plot_base64}" alt="Truncated Normal Distribution">
                    `;
                    topHospitalsContainer.appendChild(hospitalElement);

                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ 'address': hospital.name }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            const hospitalLatLng = results[0].geometry.location;
                            const hospitalMap = new google.maps.Map(document.getElementById(`hospital-map-${hospital.name.replace(/\s/g, '-')}`), {
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
                });
            })
            .catch(error => {
                document.getElementById('loading').style.display = 'none';
                console.error('Error:', error);
                console.error('Error details:', error);
                alert('An error occurred. Please try again later.');
            });
    });

    document.getElementById('locate-btn').addEventListener('click', function () {
        locateUser();
    });
};

function locateUser() {
    console.log('Locating user...');
    
    // 取得用戶輸入的地址
    const userAddress = document.getElementById('location').value;

    // 確保用戶輸入的地址不為空
    if (userAddress === "") {
        alert("請輸入地址");
        return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': userAddress }, (results, status) => {
        if (status === 'OK') {
            // 取得地址的經緯度
            const userLocation = results[0].geometry.location;

            // 設置地圖中心為輸入地址
            map.setCenter(userLocation);
            map.setZoom(15);

            // 顯示地址的詳細資訊在 info window
            infowindow.setContent(results[0].formatted_address);
            infowindow.open(map);

            // 更新輸入框中的地址（可以選擇性保留）
            document.getElementById('location').value = results[0].formatted_address;
        } else {
            // 如果地理編碼失敗，顯示錯誤訊息
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

document.addEventListener('DOMContentLoaded', function () {
    const gazeScore = document.getElementById('gaze-score');
    const facialScore = document.getElementById('facial-score');
    const armScore = document.getElementById('arm-score');
    const speechScore = document.getElementById('speech-score');
    const totalScoreElement = document.getElementById('total-score');

    function updateTotalScore() {
        // 取得 gaze deviation 的分數，如果是 abnormal，則為 2 分
        const gazeScoreValue = (parseInt(gazeScore.value) === 1) ? 2 : 0;
        // 計算其他項目的總分
        const totalScore =
            gazeScoreValue +
            (parseInt(facialScore.value) || 0) +
            (parseInt(armScore.value) || 0) +
            (parseInt(speechScore.value) || 0);
        
        // 判斷條件
    if (totalScore === 0) {
        totalScoreElement.textContent = '  ';
    } else if (gazeScoreValue === 2) {
        // 如果 gazeScore = 1，總分大於等於 4 顯示「陽性」
        if (totalScore >= 4) {
            totalScoreElement.textContent = '陽性(急性缺血性腦中風＋疑似大血管阻塞)';
            totalScoreElement.style.color = '#ff0000';
        } else {
            totalScoreElement.textContent = '陰性(急性缺血性腦中風)';
            totalScoreElement.style.color = '#012fc7';
        }
    } else {
        // 如果 gazeScore = 0，總分大於等於 3 顯示「陽性」
        if (totalScore >= 3) {
            totalScoreElement.textContent = '陽性(急性缺血性腦中風＋疑似大血管阻塞)';
            totalScoreElement.style.color = '#ff0000';
        } else {
            totalScoreElement.textContent = '陰性(急性缺血性腦中風)';
            totalScoreElement.style.color = '#012fc7';
        }
    }
}

    gazeScore.addEventListener('change', updateTotalScore);
    facialScore.addEventListener('change', updateTotalScore);
    armScore.addEventListener('change', updateTotalScore);
    speechScore.addEventListener('change', updateTotalScore);

    updateTotalScore();
    
});

/* Change color of dropdowns based on selection */
const elements = ['gaze-score', 'facial-score', 'arm-score', 'speech-score'];

elements.forEach(function (id) {
    document.getElementById(id).addEventListener('change', function () {
        this.style.color = this.value === "" ? '#ccc' : '#000';
    });
});

function validateForm(gazeScore, facialScore, armScore, speechScore, onsetTime, location) {
    let isValid = true;

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
