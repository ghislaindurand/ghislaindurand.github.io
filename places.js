

/* global LatLon, AFRAME */

//let cachePlaces = {};
let currentPosition = null;

/**
 * Calculates the haversine distance between point A, and B.
 * @param {object} latlngA {lat: number, lng: number} point A
 * @param {object} latlngB {lat: number, lng: number} point B
 */
/*
const haversineDistance = (latlngA, latlngB) => {
  const toRadian = angle => (Math.PI / 180) * angle;
  const distance = (a, b) => (Math.PI / 180) * (a - b);
  const RADIUS_OF_EARTH_IN_KM = 6371;

  let lat1 = latlngA.lat;
  let lat2 = latlngB.lat;
  const lon1 = latlngA.lng;
  const lon2 = latlngB.lng;

  const dLat = distance(lat2, lat1);
  const dLon = distance(lon2, lon1);

  lat1 = toRadian(lat1);
  lat2 = toRadian(lat2);

  // Haversine Formula
  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.asin(Math.sqrt(a));

  const finalDistance = RADIUS_OF_EARTH_IN_KM * c;

  return finalDistance;
};
*/

function wikiUrl(path, api, mobile) {
  const wikiTag = 'fr';
  let url = 'https://' + wikiTag;
  if (mobile) url += '.m';
  return url + '.wikipedia.org/' + (api ? 'w/api.php?' : 'wiki/') + path;
}

async function getOSMPlaces(position) {
  console.info('Finding nearby nodes in OSM from ' + position.latitude + ' ' + position.longitude);
  //const url = wikiUrl('action=query&format=json&origin=*&generator=geosearch&ggsradius=10000&ggsnamespace=0&ggslimit=50&formatversion=2&ggscoord=' + encodeURIComponent(position.latitude) + '%7C' + encodeURIComponent(position.longitude), true, true);
  const nodeQuery =  'node["natural"="peak"](around:10000,' + position.latitude + ',' + position.longitude + ');';
  const query = '?data=[out:json][timeout:15];(' + nodeQuery + ');out body geom;';
  const baseUrl = 'http://overpass-api.de/api/interpreter';
  const resultUrl = baseUrl + query;
  const response = await fetchWithTimeout(resultUrl);
  if (!response.ok) {
    console.error('OSM nearby failed', response);
    throw new Error('OSM nearby is down');
  }
  const osmDataAsJson = await response.json();
  console.info('Nearby response', osmDataAsJson);
  let places = [];
  for (let node of osmDataAsJson.elements) {
    const title = node.tags.name;
    console.info('Title', title);
    const place = {
      name: node.tags.name,
      location: {
        lat: node.lat,
        lng: node.lon
      }
    };
    places.push(place);
    if (places.length >= 25) break;
  }

  toast('found ' + places.length + ' places', 2000);
  return places;
}

async function getNearbyArticle(position) {

  console.info('Finding nearby article in Wikipedia from ' + position.latitude + ' ' + position.longitude);
  const url = wikiUrl('action=query&format=json&origin=*&generator=geosearch&ggsradius=10000&ggsnamespace=0&ggslimit=50&formatversion=2&ggscoord=' + encodeURIComponent(position.latitude) + '%7C' + encodeURIComponent(position.longitude), true, true);
  let pages = localStorage.getItem('cache_url:' + url);
  if (pages === null){
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error('Wikipedia nearby failed', response);
      throw new Error('Wikipedia nearby is down');
    }
    const json = await response.json();
    console.info('Nearby response', json);
    pages = json.query.pages;
    console.info('cache_url:' + url);
    localStorage.setItem('cache_url:' + url, JSON.stringify(pages));
  } else {
    pages = JSON.parse(pages);
  }
  let places = [];
  for (let page of pages) {
    const title = page.title;
    //if (seen[title]) {
    //  continue;
    //}
    //seen[title] = true;
    console.info('Title', title);
    let place = localStorage.getItem('cache_place:' + title);
    if (place === null) {
      place = await getContent(title);
      console.info('cache_place:' + title);
      localStorage.setItem('cache_place:' + title, JSON.stringify(place));
    } else {
      place = JSON.parse(place);
    }
    places.push(place);
    if (places.length >= 25) break;
  }

  const osmPlaces = await getOSMPlaces(position);
  if (osmPlaces.length) {
    places = [...places, ...osmPlaces];
  }

  toast('found ' + places.length + ' places', 2000);
  return places;
  //return null;
}

async function getContent(title) {
  console.info('Getting content from ' + title);
  const response = await fetchWithTimeout(
    wikiUrl('redirects=true&format=json&origin=*&action=query&prop=extracts|coordinates|pageimages&piprop=thumbnail&pithumbsize=512&titles=' + encodeURIComponent(title), true));
  if (!response.ok) {
    console.error('Wikipedia content call failed', response);
    throw new Error('Wikipedia content is down');
  }
  const json = await response.json();
  const page = Object.values(json.query.pages)[0];
  console.info('Page', page);
  let thumbnail = null;
  if (page.thumbnail && page.thumbnail.source && /\.(jpe?g|gif|png)$/i.test(page.thumbnail.source)) {
    thumbnail = page.thumbnail.source;
  }
  let place = {
    url: wikiUrl(encodeURIComponent(page.title), false),
    title: page.title,
    label: page.title,
    name: page.title,
    content: simpleHtmlToText(page.extract.trim()),
    //lang: state.lang.speechTag,
    /*
    coordinates: page.coordinates[0] ? {
      lat: page.coordinates[0].lat,
      lng: page.coordinates[0].lon,
    } : null,*/
    location: page.coordinates[0] ? {
      lat: page.coordinates[0].lat,
      lng: page.coordinates[0].lon,
    } : null,
    image: thumbnail,
    //pageimage: page.pageimage ? page.pageimage : null,
    //images: page.images ? page.images : null,
  };
  return place;
}

function timeout(time, message) {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('Timeout: ' + message)), time);
  });
}

function fetchWithTimeout(url, paras) {
  return Promise.race([
    fetch(url, paras), 
    timeout(15 * 1000, 'Fetch timed out for ' + url)]);
}

function simpleHtmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  remove(div.querySelector('#References'));
  remove(div.querySelector('#See_also'));
  let text = div.textContent;
  text = text.replace(/(.)\n/g, '$1.\n');
  // Remove stuff in parantheses. Nobody wants to hear that stuff.
  // This isn't how you pass the Google interview.
  // But it is technically O(n)
  for (let i = 0; i < 10; i++) {
    text = text.replace(/\([^)]+\)/g, '');
  }
  return text;
}

function remove(element) {
  if (!element) {
    return false;
  }
  return element.parentElement.removeChild(element);
}

/*
window.onload = () => {
  const scene = document.querySelector('a-scene');

  // first get current user location
  return navigator.geolocation.getCurrentPosition(function (position) {

      // than use it to load from remote APIs some places nearby
      //loadPlaces(position.coords)
      getNearbyArticle(position.coords)
                .then((places) => {
              places.forEach((place) => {
                  const latitude = place.location.lat;
                  const longitude = place.location.lng;

                  // add place name
                  const text = document.createElement('a-link');
                  text.setAttribute('gps-entity-place', `latitude: ${latitude}; longitude: ${longitude};`);
                  text.setAttribute('title', place.name);
                  text.setAttribute('href', place.url);
                  text.setAttribute('scale', '25 25 25');

                  //text.addEventListener('loaded', () => {
                  //    window.dispatchEvent(new CustomEvent('gps-entity-place-loaded'))
                  //});

                  scene.appendChild(text);
              });
          })
  },
      (err) => console.error('Error in retrieving position', err),
      {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 27000,
      }
  );
};*/

//import LatLon from './geodesy/latlon-spherical.js';

const toast = (mesg, timeout) => {
  const label = document.createElement('span');
  const container = document.createElement('div');
  container.setAttribute('id', 'place-label');
  label.innerText = mesg;
  container.appendChild(label);
  document.body.appendChild(container);
  setTimeout(() => {
    container.parentElement.removeChild(container);
  }, timeout);
};

function renderPlace(currentPosition, place) {
  let scene = document.querySelector('a-scene');

  //const latitude = place.location.lat;
  //const longitude = place.location.lng;
  //const distance = haversineDistance({
  //  lat: currentPosition.latitude,
  //  lng: currentPosition.longitude
  //}, place.location);
  //const txtDistance = (distance >= 1000) ? distance.toFixed(3) + ' km' : parseInt(distance, 10) + ' m';
  const msg = place.name;
  ////document.querySelector('a-scene').emit('log', {message: msg});
  console.log(msg);

  const p1 = new LatLon(currentPosition.latitude, currentPosition.longitude);
  console.log('p1 (currentPosition)=' + p1.lat + ' ' + p1.lon);

  const p2 = new LatLon(place.location.lat, place.location.lng);
  console.log('p2 (location)=' + p2.lat + ' ' + p2.lon);

  const d = p1.distanceTo(p2);
  const txtDistance = (d >= 1000) ? (d / 1000).toFixed(3) + ' km' : parseInt(d, 10) + ' m';
  console.log('d (distance)=' + d.toFixed(3));

  let fraction = 1;
  let scale = 10;
  let simulatedLat = p2.lat;
  let simulatedLon = p2.lon;
  if (d > 1000) {
    fraction = (1 / d) * (200 + (d / 100));
    scale = 30;
    const intermediate = p1.intermediatePointTo(p2, fraction);
    console.log('intermediate=' + intermediate.lat + ' ' + intermediate.lon + ' distance=' + p1.distanceTo(intermediate));
    simulatedLat = intermediate.lat.toFixed(4);
    simulatedLon = intermediate.lon.toFixed(4);
  } else if (d > 100) {
    fraction = (1 / d) * (100 + (d / 100));
    scale = 20;
    const intermediate = p1.intermediatePointTo(p2, fraction);
    console.log('intermediate=' + intermediate.lat + ' ' + intermediate.lon + ' distance=' + p1.distanceTo(intermediate));
    simulatedLat = intermediate.lat.toFixed(4);
    simulatedLon = intermediate.lon.toFixed(4);
  }

  //const fraction = (d > 1000) ? 0.01 : (d > 100 ? 0.1 : 1);
  ////const mid = p1.midpointTo(p2);
  ////console.log('mid=' + mid.toFixed(3))
  //const scale = (d > 1000) ? 3 : (d > 100 ? 4 : 5);

  //const intermediate = p1.intermediatePointTo(p2, fraction);
  //console.log('intermediate=' + intermediate.lat + ' ' + intermediate.lon);
  //const latInter = intermediate.lat;
  //const lngInter = intermediate.lon;

  // add place item
  if (place.image) {
    const item = document.createElement('a-image');
    //const item = document.createElement('a-box');
    //item.setAttribute('gps-entity-place', `latitude: ${latitude}; longitude: ${longitude}`);
    item.setAttribute('gps-entity-place', `latitude: ${simulatedLat}; longitude: ${simulatedLon};`);
    item.setAttribute('name', place.name + ' ' + txtDistance);
    item.setAttribute('src', place.image);
    // for debug purposes, just show in a bigger scale, otherwise I have to personally go on places...
    //item.setAttribute('scale', '20, 20');
    item.setAttribute('initialScale', scale);
    item.setAttribute('scale', `${scale}, ${scale}`);
    //item.setAttribute('scale', `${scale}, ${scale}, ${scale}`);
    //item.addEventListener('loaded', () => window.dispatchEvent(new CustomEvent('gps-entity-place-loaded')));
    item.setAttribute('look-at', '[gps-camera]');

    item.addEventListener('mouseenter', function (ev) {
      const initialScale = ev.target.getAttribute('initialScale');
      item.setAttribute('scale', `${initialScale*2}, ${initialScale*2}`);
      const name = ev.target.getAttribute('name');
      toast(name, 1500);
    });
    item.addEventListener('mouseleave', function (ev) {
      const initialScale = ev.target.getAttribute('initialScale');
      item.setAttribute('scale', `${initialScale}, ${initialScale}`);
    });
 
    scene.appendChild(item);
  }

  /*
  const clickListener = (ev) => {
    ev.stopPropagation();
    ev.preventDefault()
    const name = ev.target.getAttribute('name');
    const el = ev.detail.intersection && ev.detail.intersection.object.el;
    if (el && el === ev.target) {
      toast(name, 1500);
    }
  };
  item.addEventListener('click', clickListener);*/

  
  /*item.addEventListener('click', function (ev) {
    const url = ev.target.getAttribute('src');
    toast(url, 1500);
    //document.location = url;
  });*/



  const text = document.createElement('a-text');

  //geometry="primitive: plane; width: auto; height: auto" material="color: #333"
  //text.setAttribute('geometry', 'primitive: plane; width: auto; height: auto');
  //text.setAttribute('material', 'color: #333');


  text.setAttribute('font', 'roboto');

  text.setAttribute('gps-entity-place', `latitude: ${simulatedLat}; longitude: ${simulatedLon};`);
  //text.setAttribute('text', `color: #BBB; align: center; baseline: bottom; value: "${place.name} ${txtDistance}";`);
  //text.setAttribute('color', '#fff');
  text.setAttribute('align', 'center');
  text.setAttribute('baseline', 'bottom');
  text.setAttribute('value', `${place.name}\n${txtDistance}`);
  text.setAttribute('position', `0, ${scale/2}, 0`);
  text.setAttribute('scale', `${scale/2}, ${scale/2}`);
  text.setAttribute('look-at', '[gps-camera]');
  scene.appendChild(text);
  /*
  <a-entity
  text="value: Hello, A-Frame!; color: #BBB"
  position="-0.9 0.2 -3"
  scale="1.5 1.5 1.5"></a-entity>*/


  /*
  const link = document.createElement('a-link');
  link.setAttribute('gps-entity-place', `latitude: ${latInter}; longitude: ${lngInter};`);
  link.setAttribute('title', place.name);
  link.setAttribute('href', place.url);
  
  link.setAttribute('image', place.image);

  //text.setAttribute('scale', '5 5 5');
  //const scale = (d > 1000) ? 5 : (d > 100 ? 10 : 15);

  link.setAttribute('scale', `${scale} ${scale} ${scale}`);

  link.addEventListener('loaded', () => {
    window.dispatchEvent(new CustomEvent('gps-entity-place-loaded'))
  });
  const clickListener = (ev) => {
    ev.stopPropagation();
    ev.preventDefault()
    const title = ev.target.getAttribute('title');
    const el = ev.detail.intersection && ev.detail.intersection.object.el;
    if (el && el === ev.target) {
      toast(title, 1500);
    }
  };
  link.addEventListener('click', clickListener);

  link.addEventListener('mouseenter', function (ev) {
    const title = ev.target.getAttribute('title');
    toast(title, 1500);
  });

  scene.appendChild(link);
  */ 

}

function renderPlaces(currentPosition, places) {
  places.forEach((place) => {
    if (place.image !== null) {
      renderPlace(currentPosition, place);
    }
  });
}

AFRAME.registerComponent('geoloc', {
  init: function () {
    // Code here.
    console.log(this.el);
    toast('getCurrentPosition...', 2000);

    const geolocSuccess = (position) => {
      currentPosition = position.coords;
      toast('found position', 2000);

      localStorage.setItem('lastPosition', JSON.stringify(currentPosition));
      getNearbyArticle(currentPosition)
        .then((places) => {
          renderPlaces(currentPosition, places);
        });
    };
  
    const geolocError = (err) => {
      console.error('Error in retrieving position', err);
      const lastPosition = localStorage.getItem('lastPosition');
      if (lastPosition !== null) {
        currentPosition = JSON.parse(lastPosition);
        toast('position not found : use last position found', 2000);
      } else {
        currentPosition = {latitude: 43.330138, longitude: 5.492356};
        toast('position not found : use home', 2000);
      }

      getNearbyArticle(currentPosition)
        .then((places) => {
          renderPlaces(currentPosition, places);
        });
    };
    const geolocOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    };
    navigator.geolocation.getCurrentPosition(
      geolocSuccess,
      geolocError,
      geolocOptions
    );
    /*
    const watchSuccess = (position) => {
      currentPosition = position.coords;
      toast('watchSuccess found position', 2000);

      localStorage.setItem('lastPosition', JSON.stringify(currentPosition));
      getNearbyArticle(currentPosition)
        .then((places) => {
          renderPlaces(currentPosition, places);
        });
    };
    const watchError = (err) => {
      console.error('Error in retrieving position watchError', err);

    };

    let id = navigator.geolocation.watchPosition(watchSuccess, watchError, geolocOptions);
*/
  }
});