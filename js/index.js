let map;
let infowindow;
let autocomplete;

function initMap() {
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
        
        const gazeScoreValue = parseInt(document.getElementById('gaze-score').value) || 0;
        const facialScoreValue = parseInt(document.getElementById('facial-score').value) || 0;
        const armScoreValue = parseInt(document.getElementById('arm-score').value) || 0;
        const speechScoreValue = parseInt(document.getElementById('speech-score').value) || 0;
        const cpssScoreValue = facialScoreValue + armScoreValue + speechScoreValue;
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
        })
        .then(response => {
            if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
})
        .then(data => {
            document.getElementById('loading').style.display = 'none';

.catch(error => {
    document.getElementById('loading').style.display = 'none';
    console.error('Error:', error.message);
    console.error('Error details:', error);
    alert('An error occurred. Please try again later.');
});
        
            const topHospitalsContainer = document.getElementById('topHospitals');
            topHospitalsContainer.innerHTML = '';

            const criticalMessageContainer = document.getElementById('critical-message-container');
            criticalMessageContainer.innerHTML = '';

            const criticalMessage = document.createElement('div');
            criticalMessage.classList.add('critical-message');
            criticalMessage.innerText = "The patient's condition is critical and requires immediate hospital treatment!";
            criticalMessageContainer.appendChild(criticalMessage);

            data.top_hospitals.forEach(hospital => {
                const roundedProbability = (hospital.probability).toFixed(3);
                const meanMinutes = (hospital.mean / 60).toFixed(3);

                const hospitalElement = document.createElement('div');
                hospitalElement.classList.add('hospital-card');
                hospitalElement.innerHTML = `
                    <h3>${hospital.priority}</h3>
                    <p><strong>Hospital Name:</strong> ${hospital.name}</p>
                    <p><strong>The probability of receiving definitive treatment at the chosen hospital within the threshold:</strong> ${roundedProbability}</p>
                    <p><strong>The mean time from symptom onset to receiving definitive treatment:</strong> ${meanMinutes} minutes</p>
                    <button onclick="window.open('${hospital.google_map_url}', '_blank')">Head for this hospital</button>
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
        });
    });    

    document.getElementById('locate-btn').addEventListener('click', function() {
        locateUser();
    });
}

function locateUser() {
    console.log('Locating user...');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            map.setCenter(userLocation);
            map.setZoom(15);

            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ 'location': userLocation }, (results, status) => {
                if (status === 'OK') {
                    if (results[0]) {
                        infowindow.setContent(results[0].formatted_address);
                        infowindow.open(map);
                        document.getElementById('location').value = results[0].formatted_address;
                    } else {
                        window.alert('No results found');
                    }
                } else {
                    window.alert('Geocoder failed due to: ' + status);
                }
            });

        }, () => {
            handleLocationError(true, map.getCenter());
        });
    } else {
        handleLocationError(false, map.getCenter());
    }
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
        const totalScore = 
            (parseInt(gazeScore.value) || 0)+
            (parseInt(facialScore.value) || 0)+
            (parseInt(armScore.value) || 0)+
            (parseInt(speechScore.value) || 0);
        totalScoreElement.textContent = totalScore;
    }

    gazeScore.addEventListener('change', updateTotalScore);
    facialScore.addEventListener('change', updateTotalScore);
    armScore.addEventListener('change', updateTotalScore);
    speechScore.addEventListener('change', updateTotalScore);
});

/* Change color of dropdowns based on selection */
var elements = ['gaze-score','facial-score', 'arm-score', 'speech-score'];

elements.forEach(function(id) {
    document.getElementById(id).addEventListener('change', function() {
        this.style.color = this.value === "" ? '#ccc' : '#000';
    });
});

function validateForm(gazeScore, facialScore, armScore, speechScore, onsetTime, location) {
    let isValid = true;

    // show all the args
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
    console.log('isValid:', isValid);
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
