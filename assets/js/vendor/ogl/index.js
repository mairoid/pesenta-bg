/* Минимален собствен барел за ogl (v1.0.11, MIT license, https://github.com/oframe/ogl) —
   само класовете, реално ползвани от voice-orb.js. Пълният пакет включва GLTFLoader,
   Text, Draco/Basis текстури, Orbit контроли и др., които тук не са нужни — self-hosted
   вместо CDN import, за да не се чупи политиката "без външни заявки" на сайта (виж
   legal-config.js). Не презаписвай с оригиналния src/index.js на ogl — той би довлякъл
   целия пакет. */
export { Renderer } from './core/Renderer.js';
export { Program } from './core/Program.js';
export { Mesh } from './core/Mesh.js';
export { Triangle } from './extras/Triangle.js';
export { Vec3 } from './math/Vec3.js';
