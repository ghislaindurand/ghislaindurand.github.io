if(!self.define){let e,i={};const s=(s,n)=>(s=new URL(s+".js",n).href,i[s]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=i,document.head.appendChild(e)}else e=s,importScripts(s),i()})).then((()=>{let e=i[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(n,r)=>{const t=e||("document"in self?document.currentScript.src:"")||location.href;if(i[t])return;let o={};const c=e=>s(e,t),d={module:{uri:t},exports:o,require:c};i[t]=Promise.all(n.map((e=>d[e]||c(e)))).then((e=>(r(...e),o)))}}define(["./workbox-fa446783"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/index-LdmgMErF.js",revision:null},{url:"assets/index-pc1EaW1N.css",revision:null},{url:"index.html",revision:"f3aec4792f75c584b638edb981d4e207"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"img/icons/fish-192x192.png",revision:"79b90b4c8566946e0c8b6df150154ca1"},{url:"img/icons/fish-512x512.png",revision:"857636ee9c9542156809826810b1056d"},{url:"manifest.webmanifest",revision:"833dceac11099c03f8a06fd64df7a299"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
