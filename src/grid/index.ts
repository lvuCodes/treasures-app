// Board geometry core. Drop-in, framework-free: import from here for the fixed
// board size and the pure grid transforms (crop, re-centre, signature) every map
// feature shares. See README.md for the terrain-code contract.
export {
  SIZE,
  emptyGrid,
  range,
  withEntry,
  boundingBox,
  centerGrid,
  mapSignature,
} from "./geometry";
