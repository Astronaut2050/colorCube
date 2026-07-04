"use strict";const t=[1,2,3,4,5],e=t.length-1;function r(r){return t[Math.max(0,Math.min(e,r))]}exports.MAX_LEVEL=e,exports.scoreForLevel=r,exports.scoreForLine=function(t,e){return t*r(e)};
