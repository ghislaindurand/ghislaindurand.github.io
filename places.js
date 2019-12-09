const loadPlaces = function (coords) {
  // COMMENT FOLLOWING LINE IF YOU WANT TO USE STATIC DATA AND ADD COORDINATES IN THE FOLLOWING 'PLACES' ARRAY
  const method = 'api';

  const PLACES = [
      {
          name: "Your place name",
          location: {
              lat: 0, // add here latitude if using static data
              lng: 0, // add here longitude if using static data
          }
      },
  ];

  if (method === 'api') {
      return loadPlaceFromAPIs(coords);
  }

  return PLACES;
};

// getting places from REST APIs
function loadPlaceFromAPIs(position) {


  

  /*
  const params = {
      radius: 300,    // search places not farther than this value (in meters)
      clientId: 'HZIJGI4COHQ4AI45QXKCDFJWFJ1SFHYDFCCWKPIJDWHLVQVZ',
      clientSecret: 'GYRKWWJMO2WK3KIRWBXIN5FQAWXTVFIK2QM4VQWNQ4TRAKWH',
      version: '20300101',    // foursquare versioning, required but unuseful for this demo
  };

  // CORS Proxy to avoid CORS problems
  const corsProxy = 'https://cors-anywhere.herokuapp.com/';

  // Foursquare API
  const endpoint = `${corsProxy}https://api.foursquare.com/v2/venues/search?intent=checkin
      &ll=${position.latitude},${position.longitude}
      &radius=${params.radius}
      &client_id=${params.clientId}
      &client_secret=${params.clientSecret}
      &limit=15
      &v=${params.version}`;
  return fetch(endpoint)
      .then((res) => {
          return res.json()
              .then((resp) => {
                  return resp.response.venues;
              })
      })
      .catch((err) => {
          console.error('Error with places API', err);
      })*/
};
function wikiUrl(path, api, mobile) {
  const wikiTag = 'fr';
  let url = 'https://' + wikiTag;
  if (mobile) url += '.m';
  return url + '.wikipedia.org/' + (api ? 'w/api.php?' : 'wiki/') + path
}

async function getNearbyArticle(position) {
  console.info('Finding nearby article');
  const response = await fetchWithTimeout(wikiUrl('action=query&format=json&origin=*&generator=geosearch&ggsradius=10000&ggsnamespace=0&ggslimit=50&formatversion=2&ggscoord=' + encodeURIComponent(position.latitude) + '%7C' + encodeURIComponent(position.longitude), true, true));
  if (!response.ok) {
    console.error('Wikipedia nearby failed', response)
    throw new Error('Wikipedia nearby is down');
  }
  const json = await response.json();
  console.info('Nearby response', json);
  const pages = json.query.pages;
  let places = [];
  for (let page of pages) {
    const title = page.title;
    //if (seen[title]) {
    //  continue;
    //}
    //seen[title] = true;
    console.info('Title', title);
    places.push(await getContent(title));
    if (places.length >= 5) break;
  }
  return places;
  //return null;
}

async function getContent(title) {
  console.info('Getting content');
  const response = await fetchWithTimeout(wikiUrl('redirects=true&format=json&origin=*&action=query&prop=extracts|coordinates&titles=' + encodeURIComponent(title), true));
  if (!response.ok) {
    console.error('Wikipedia content call failed', response)
    throw new Error('Wikipedia content is down');
  }
  const json = await response.json();
  const page = Object.values(json.query.pages)[0];
  console.info('Page', page)
  //seen[page.title] = true;
  return {
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
  };
}

function timeout(time, message) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('Timeout: ' + message)), time);
  })
}

function fetchWithTimeout(url, paras) {
  return Promise.race([fetch(url, paras), 
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
    text = text.replace(/\([^\)]+\)/g, '');
  }
  return text;
}

function remove(element) {
  if (!element) {
    return false;
  }
  return element.parentElement.removeChild(element);
}


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
                  text.setAttribute('href', 'http://www.example.com/');
                  text.setAttribute('scale', '13 13 13');

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
};