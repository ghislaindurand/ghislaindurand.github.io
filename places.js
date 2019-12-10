
let cachePlaces = {};

function wikiUrl(path, api, mobile) {
  const wikiTag = 'fr';
  let url = 'https://' + wikiTag;
  if (mobile) url += '.m';
  return url + '.wikipedia.org/' + (api ? 'w/api.php?' : 'wiki/') + path
}

async function getNearbyArticle(position) {
  console.info('Finding nearby article');
  const url = wikiUrl('action=query&format=json&origin=*&generator=geosearch&ggsradius=10000&ggsnamespace=0&ggslimit=50&formatversion=2&ggscoord=' + encodeURIComponent(position.latitude) + '%7C' + encodeURIComponent(position.longitude), true, true);
  let pages = localStorage.getItem('cache_url:' + url);
  if (pages === null){
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error('Wikipedia nearby failed', response)
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
  return places;
  //return null;
}

async function getContent(title) {
  console.info('Getting content');
  const response = await fetchWithTimeout(wikiUrl('redirects=true&format=json&origin=*&action=query&prop=extracts|coordinates|pageimages&titles=' + encodeURIComponent(title), true));
  if (!response.ok) {
    console.error('Wikipedia content call failed', response)
    throw new Error('Wikipedia content is down');
  }
  const json = await response.json();
  const page = Object.values(json.query.pages)[0];
  console.info('Page', page);
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
    image: (page.thumbnail && page.thumbnail.source) ? page.thumbnail.source : null,
  };
  return place;
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


function renderIcon(place) {
  let scene = document.querySelector('a-scene');

      const latitude = place.location.lat;
      const longitude = place.location.lng;

      // add place icon
      const icon = document.createElement('a-image');
      icon.setAttribute('gps-entity-place', `latitude: ${latitude}; longitude: ${longitude}`);
      icon.setAttribute('name', place.name);
      icon.setAttribute('src', place.image);

      // for debug purposes, just show in a bigger scale, otherwise I have to personally go on places...
      icon.setAttribute('scale', '20, 20');

      icon.addEventListener('loaded', () => window.dispatchEvent(new CustomEvent('gps-entity-place-loaded')));

      const clickListener = function (ev) {
          ev.stopPropagation();
          ev.preventDefault();

          const name = ev.target.getAttribute('name');

          const el = ev.detail.intersection && ev.detail.intersection.object.el;

          if (el && el === ev.target) {
              const label = document.createElement('span');
              const container = document.createElement('div');
              container.setAttribute('id', 'place-label');
              label.innerText = name;
              container.appendChild(label);
              document.body.appendChild(container);

              setTimeout(() => {
                  container.parentElement.removeChild(container);
              }, 1500);
          }
      };

      icon.addEventListener('click', clickListener);

      scene.appendChild(icon);
}

AFRAME.registerComponent('geoloc', {
  init: function () {
    // Code here.
    console.log(this.el);

    const scene = document.querySelector('a-scene');
    navigator.geolocation.getCurrentPosition(function (position) {

      // than use it to load from remote APIs some places nearby
      //loadPlaces(position.coords)
      getNearbyArticle(position.coords)
                .then((places) => {
              places.forEach((place) => {

                renderIcon(place);
/*
                  const latitude = place.location.lat;
                  const longitude = place.location.lng;

                  // add place name
                  const text = document.createElement('a-link');
                  text.setAttribute('gps-entity-place', `latitude: ${latitude}; longitude: ${longitude};`);
                  text.setAttribute('title', place.name);
                  text.setAttribute('href', place.url);
                  if (place.image !== null)
                    text.setAttribute('image', place.image);
                  text.setAttribute('scale', '25 25 25');

                  //text.addEventListener('loaded', () => {
                  //    window.dispatchEvent(new CustomEvent('gps-entity-place-loaded'))
                  //});

                  scene.appendChild(text);
                  */
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

  }
});