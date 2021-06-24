

/* global LatLon, AFRAME */

//let cachePlaces = {};
let currentPosition = null;

const assets = {
  // natural
  'icon-peak': './img/icons/peak-16px.png',
  'icon-saddle': './img/icons/saddle-16px.png',
  'icon-spring': './img/icons/spring-120px.png',
  // leisure
  'icon-playground': './img/icons/playground-28px.png',
};

function getOSMImage(node) {
  if (node.tags.natural === 'peak')
    return '#icon-peak';
  else if (node.tags.natural === 'saddle')
    return '#icon-saddle';
  else if (node.tags.natural === 'spring')
    return '#icon-spring';
  else if (node.tags.leisure === 'playground')
    return '#icon-playground';
  return null;
}

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

function loadAssets() {
  const container = document.querySelector('a-assets');
  for (const elem in assets) {
    const img = document.createElement('img');
    img.setAttribute('id', elem);
    img.setAttribute('src', assets[elem]);
    container.appendChild(img);
  }


}

function wikiUrl(path, api, mobile) {
  const wikiTag = 'fr';
  let url = 'https://' + wikiTag;
  if (mobile) url += '.m';
  return url + '.wikipedia.org/' + (api ? 'w/api.php?' : 'wiki/') + path;
}


async function getOSMPlaces(position, options) {
  options = options || {};
  options.nodes = options.nodes || [{search: '"natural"="peak"'}];
  options.around = options.around || 5000;  // distance in meters
  options.timeout = options.timeout || 30;  // timeout in seconds

  loadAssets();

  console.info('Finding nearby nodes in OSM from ' + position.latitude + ' ' + position.longitude);
  let nodeQuery = '';
  for (const node of options.nodes) {
    const around = node.around || options.around;
    nodeQuery += 'node[' + node.search + '](around:' + around + ',' + position.latitude + ',' + position.longitude + ');';
  }
  const query = '?data=[out:json][timeout:' + options.timeout + '];(' + nodeQuery + ');out body geom;';
  const baseUrl = 'https://overpass-api.de/api/interpreter';
  const resultUrl = baseUrl + query;
  try {
    const response = await fetchWithTimeout(resultUrl);
    if (!response.ok) {
      console.error('OSM nearby failed', response);
      throw new Error('OSM nearby failed');
    }
    const osmDataAsJson = await response.json();
    console.info('Nearby response for OSM url: ' + resultUrl + ' = ', JSON.stringify(osmDataAsJson));
    let places = [];
    for (const node of osmDataAsJson.elements) {
      const title = node.tags.name;
      if (!title) {
        continue;
      }
      console.info('Title', title);
      let place = {
        origin: 'OSM',
        name: node.tags.name,
        nodeSearch: options.nodes,
        location: {
          lat: node.lat,
          lng: node.lon
        },
        tags: node.tags
      };
      if (node.tags.website) {
        place.url = node.tags.website;
      }
      const image = getOSMImage(node);
      if (image !== null) place.image = image;
      places.push(place);
      renderPlace(position, place);
      //if (places.length >= 25) break;
    }
  
    toast('getOSMPlaces (' + options.node + ') found ' + places.length + ' places', 2000);
    return places;
  } catch (err) {
    console.error('OSM nearby failed', err);
    throw new Error('OSM nearby failed');
  }
}

async function getWikipediaPlaces(position) {
  console.info('Finding nearby article in Wikipedia from ' + position.latitude + ' ' + position.longitude);
  const url = wikiUrl('action=query&format=json&origin=*&generator=geosearch&ggsradius=10000&ggsnamespace=0&ggslimit=50&formatversion=2&ggscoord=' + encodeURIComponent(position.latitude) + '%7C' + encodeURIComponent(position.longitude), true, true);
  let pages = localStorage.getItem('cache_url:' + url);
  if (pages === null) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        console.error('Wikipedia nearby failed', response);
        throw new Error('Wikipedia nearby failed');
      }
      const json = await response.json();
      console.info('Nearby response', json);
      pages = json.query.pages;
    } catch (err) {
      console.error('Wikipedia nearby failed', err);
      throw new Error('Wikipedia nearby failed');
    }

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
      try {
        place = await getWikipediaContent(title);
      } catch (err) {
        console.error('getWikipediaContent failed', err);
        throw new Error('getWikipediaContent failed');
      }
      console.info('cache_place:' + title);
      localStorage.setItem('cache_place:' + title, JSON.stringify(place));
    } else {
      place = JSON.parse(place);
    }
    places.push(place);
    renderPlace(position, place);
    if (places.length >= 25) break;
  }

  return places;

}

async function getNearbyPlaces(position) {
  try {
    const results = await Promise.all([
      getWikipediaPlaces(position),
      //getOSMPlaces(position),
      getOSMPlaces(position, {
        nodes: [
          //{'search': '"natural"="peak"', around: 30000},
          {'search': '"natural"', around: 10000},
          {search: '"tourism"~"attraction|museum"'},
          //{search: '"historic"'},
          {search: '"leisure"'},
        ],
      }),
      /*getOSMPlaces(position, {
        node: '"historic"'
      }),
      getOSMPlaces(position, {
        node: '"leisure"'
      }),*/
    ]);
    const places = [].concat.apply([], results);
    toast('found ' + places.length + ' places', 5000);
    return places;
  } catch (err) {
    console.error('getNearbyPlaces failed', err);
    //throw new Error('getNearbyPlaces failed');
  }


/*
  const wikipediaPlaces = getWikipediaPlaces(position);

  const osmPlacesPeak = await getOSMPlaces(position);
  if (osmPlacesPeak.length) {
    places = [...places, ...osmPlacesPeak];
  }
  const osmPlacesTourism = await getOSMPlaces(position, {
    node: '"tourism"~"attraction|museum"'
  });
  if (osmPlacesTourism.length) {
    places = [...places, ...osmPlacesTourism];
  }
  const osmPlacesHistoric = await getOSMPlaces(position, {
    node: '"historic"'
  });
  if (osmPlacesHistoric.length) {
    places = [...places, ...osmPlacesHistoric];
  }

  toast('found ' + places.length + ' places', 2000);
  return places;
  //return null;
  */
}

async function getWikipediaContent(title) {
  console.info('Getting content from ' + title);
  try {
    const response = await fetchWithTimeout(
      wikiUrl('redirects=true&format=json&origin=*&action=query&prop=extracts|coordinates|pageimages&piprop=thumbnail&pithumbsize=512&titles=' +
      encodeURIComponent(title), true));
    if (!response.ok) {
      console.error('getWikipediaContent failed', response);
      throw new Error('getWikipediaContent failed');
    }
    const json = await response.json();
    const page = Object.values(json.query.pages)[0];
    console.info('Page', page);
    let thumbnail = null;
    if (page.thumbnail && page.thumbnail.source && /\.(jpe?g|gif|png)$/i.test(page.thumbnail.source)) {
      thumbnail = page.thumbnail.source;
    }
    let place = {
      origin: 'Wikipedia',
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
  } catch (err) {
    console.error('getWikipediaContent failed', err);
    throw new Error('getWikipediaContent failed');
  }

}

/**
 * reject if timeout happen before promise finish
 *
 * @param {Promise} promise
 * @param {int} ms
 * @returns Promise
 */
function timeoutPromise(promise, ms) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('promise timeout'));
    }, ms);
    promise.then(
      (res) => {
        clearTimeout(timeoutId);
        resolve(res);
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(err);
      }
    );
  })
}


function fetchWithTimeout(url, init = {}, ms = 30000) {
  return timeoutPromise(fetch(url, init), ms);
}

function simpleHtmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  remove(div.querySelector('#References'));
  remove(div.querySelector('#See_also'));
  let text = div.textContent;
  text = text.replace(/(.)\n/g, '$1.\n');
  // Remove stuff in parentheses. Nobody wants to hear that stuff.
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
  const scene = document.querySelector('a-scene');

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
  const txtDistance = (d >= 1000) ? (d / 1000).toFixed(1) + ' km' : parseInt(d, 10) + ' m';
  console.log('d (distance)=' + txtDistance);

  let fraction = 1;
  let scale = 5;
  let simulatedLat = p2.lat;
  let simulatedLon = p2.lon;
  if (d > 1000) {
    fraction = (1 / d) * (200 + (d / 100));
    scale *= 3;
    const intermediate = p1.intermediatePointTo(p2, fraction);
    console.log('intermediate=' + intermediate.lat + ' ' + intermediate.lon + ' distance=' + p1.distanceTo(intermediate));
    simulatedLat = intermediate.lat.toFixed(4);
    simulatedLon = intermediate.lon.toFixed(4);
  } else if (d > 100) {
    fraction = (1 / d) * (100 + (d / 100));
    scale *= 2;
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
  let item = null;
  //if (place.origin === 'Wikipedia' && place.image) {
  //  item = document.createElement('a-image');
  //  //const item = document.createElement('a-box');
  //  //item.setAttribute('gps-entity-place', `latitude: ${latitude}; longitude: ${longitude}`);
  //  item.setAttribute('data-primitive', 'image');
  //  item.setAttribute('src', place.image);
  //  // for debug purposes, just show in a bigger scale, otherwise I have to personally go on places...
  //  //item.setAttribute('scale', '20, 20');
  //  item.setAttribute('scale', `${scale}, ${scale}`);
  //  //item.setAttribute('scale', `${scale}, ${scale}, ${scale}`);
  //  //item.addEventListener('loaded', () => window.dispatchEvent(new CustomEvent('gps-entity-place-loaded')));
  //
  //
  //}
  //else if (place.origin === 'OSM') {
  if (place.image) {
    item = document.createElement('a-image');
    item.setAttribute('data-primitive', 'image');
    item.setAttribute('src', place.image);
    item.setAttribute('scale', `${scale}, ${scale}`);
  } else if (/roi|ranch/i.test(place.name)) {
    item = document.createElement('a-entity');
    item.setAttribute('gltf-model', '#Castle');
    scale = 500;
    item.setAttribute('scale', `${scale}, ${scale}, ${scale}`);
  } else if (/grotte/i.test(place.name)) {
    item = document.createElement('a-entity');
    item.setAttribute('gltf-model', '#Mammouth');
    scale = 50;
    item.setAttribute('scale', `${scale}, ${scale}, ${scale}`);
  } else {
    item = document.createElement('a-entity');
    item.setAttribute('data-primitive', 'box');
    item.setAttribute('geometry', 'primitive: box; width: 1; height: 1; depth: 1');
    item.setAttribute('material', 'color: #6666ff;');
    item.setAttribute('scale', `${scale}, ${scale}, ${scale}`);
  }
  // if (place.tags && place.tags.natural && place.tags.natural === 'peak') {
  // item.setAttribute('data-primitive', 'cone');
  // item.setAttribute('geometry', 'primitive: cone; radiusBottom: 1; radiusTop: 0.1');
  // if (place.image)
  // item.setAttribute('material', `src: ${place.image};`);
  // else
  // item.setAttribute('material', 'color: #4CffD9;');
  // item.setAttribute('scale', `${scale}, ${scale}, ${scale}`);
  // } else {
  // item.setAttribute('data-primitive', 'box');
  // item.setAttribute('geometry', 'primitive: box; width: 1; height: 1; depth: 1');
  // item.setAttribute('material', 'color: #6666ff;');
  //item.setAttribute('scale', `${scale}, ${scale}, ${scale}`);
  // }
  //entity.setAttribute('look-at', '[gps-camera]');

  //}

  if (item !== null) {
    // common attributes
    item.setAttribute('data-initialScale', scale);
    item.setAttribute('data-name', place.name + ' ' + txtDistance);
    item.setAttribute('gps-entity-place', `latitude: ${simulatedLat}; longitude: ${simulatedLon};`);
    if (place.url) {
      item.setAttribute('data-url', place.url);
    }
    item.setAttribute('cursor-listener', '');
    item.setAttribute('look-at', '[gps-camera]');

    item.setAttribute('gesture-handler', '');

    scene.appendChild(item);
  }

  if (place.name !== null) {
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
    text.setAttribute('position', `0, ${scale/2}, -1`);
    text.setAttribute('scale', `${scale/2}, ${scale/2}`);
    text.setAttribute('look-at', '[gps-camera]');
    scene.appendChild(text);
  }

}

/*
function renderPlaces(currentPosition, places) {
  places.forEach((place) => {
    if (place.image !== null) {
      renderPlace(currentPosition, place);
    }
  });
}*/

let heading; // declare compass vars

AFRAME.registerComponent('geoloc', {
  init: function () {
    //console.log(this.el);

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', function(e) { // get current compass heading
        if (e.webkitCompassHeading) heading = e.webkitCompassHeading; // get webkit compass heading
        else heading = e.alpha; // get android compass heading
      });
    }

    toast('getCurrentPosition...', 2000);

    const geolocSuccess = (position) => {
      currentPosition = position.coords;
      toast('found position', 2000);

      localStorage.setItem('lastPosition', JSON.stringify(currentPosition));
      getNearbyPlaces(currentPosition);
      /*getNearbyArticle(currentPosition)
        .then((places) => {
          renderPlaces(currentPosition, places);
        });*/
    };
  
    const geolocError = (err) => {
      console.error('Error in retrieving position', err);
      const lastPosition = localStorage.getItem('lastPosition');
      if (lastPosition) {
        currentPosition = JSON.parse(lastPosition);
        toast('position not found : use last position found (' + lastPosition + ')', 2000);
      } else {
        currentPosition = {latitude: 43.330138, longitude: 5.492356};
        toast('position not found : use home', 2000);
      }

      getNearbyPlaces(currentPosition);
      /*getNearbyArticle(currentPosition)
        .then((places) => {
          renderPlaces(currentPosition, places);
        });*/
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


// Component to change to a sequential color on click.
AFRAME.registerComponent('cursor-listener', {
  init: function () {
    /*
    var lastIndex = -1;
    var COLORS = ['red', 'green', 'blue'];
    this.el.addEventListener('click', function (evt) {
      lastIndex = (lastIndex + 1) % COLORS.length;
      this.setAttribute('material', 'color', COLORS[lastIndex]);
      console.log('I was clicked at: ', evt.detail.intersection.point);
    });*/

    this.el.addEventListener('mouseenter', function (_ev) {
      const initialScale = this.getAttribute('data-initialScale');
      const primitive = this.getAttribute('data-primitive');
      const scale = primitive === 'image' ?
        `${initialScale*3}, ${initialScale*3}, 1` :
        `${initialScale*3}, ${initialScale*3}, ${initialScale*3}`;
      this.setAttribute('scale', scale);
      const name = this.getAttribute('data-name');
      toast(name, 1500);
    });

    this.el.addEventListener('mouseleave', function (_ev) {
      const initialScale = this.getAttribute('data-initialScale');
      const primitive = this.getAttribute('data-primitive');
      const scale = primitive === 'image' ?
        `${initialScale}, ${initialScale}, 1` :
        `${initialScale}, ${initialScale}, ${initialScale}`;
      this.setAttribute('scale', scale);
    });

    this.el.addEventListener('click', function (_ev) {
      const url = this.getAttribute('data-url');
      if (url) {
        document.location = url;
        return;
      }
      const name = this.getAttribute('data-name');
      toast(name, 1500);
    });
 

  }
});


const directions = ['N', 'O', 'S', 'E'];
AFRAME.registerComponent('cockpit', {
  tick: function () {
    const bearing = document.querySelector('#bearing'); // set bearing
    
    let bearingValue = '';
    for (let i = 0; i < 4; i++) {
      const quarter = ((i + 1) * 90); 
      //if (heading < ((i+1) * 45)) bearingValue += directions[i];
      if (heading <= (quarter - 45)) {
        bearingValue += directions[i];
        if (heading > (quarter - 67.5)) {
          bearingValue += (i < 3) ? directions[i+1] : directions[0];
        }
        break;
      } else if (heading < quarter) {
        bearingValue += (i < 3) ? directions[i+1] : directions[0];
        if (heading < (quarter - 22.5)) {
          bearingValue += directions[i];
        }
        break;
      }
    }

    //bearing.setAttribute('value', Math.round(heading)); // set bearing number
    bearing.setAttribute('value', bearingValue); // set bearing number

    const compass = document.querySelector('#compass'); // set compass
    compass.setAttribute('rotation', {z: 0-heading}); // set compass angle, reverse direction
  },
});

