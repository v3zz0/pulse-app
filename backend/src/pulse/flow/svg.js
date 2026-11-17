"use strict";
// Flow's fixed historical SVG DTD is removed. No XML entity resolution or active content.
function sanitize(svg){
 if(typeof svg!=="string"||Buffer.byteLength(svg)>1024*1024)throw new Error('SVG non valido');
 svg=svg.replace(/<\?xml[^?]*\?>\s*/g,'').replace(/<!DOCTYPE svg PUBLIC "-\/\/W3C\/\/DTD SVG 20010904\/\/EN"\s+"http:\/\/www\.w3\.org\/TR\/2001\/REC-SVG-20010904\/DTD\/svg10\.dtd">\s*/g,'');
 if(/<!|<\?|\bon[a-z]+\s*=|\b(?:href|xlink:href)\s*=|url\s*\(|javascript:|data:|<\s*\/??\s*(?:script|style|image|foreignObject|use|animate|set)\b/i.test(svg))throw new Error('Contenuto SVG attivo o esterno non ammesso');
 const tags=[...svg.matchAll(/<\/?([\w:-]+)\b/g)].map(m=>m[1]);
 if(!tags.length||tags.some(t=>!['svg','metadata','g','path'].includes(t))||!/<svg\b[^>]*\bviewBox=/.test(svg)||!/<path\b/.test(svg))throw new Error('Struttura SVG non ammessa');
 return svg;
}
module.exports={sanitize};
