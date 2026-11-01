# Third-party notices

The v4 map bundles the following runtime and material files locally. They make no requests to a third-party mapping or asset service while the app is running.

## Three.js and OrbitControls

- Version: Three.js r160 (npm package `three` 0.160.0).
- Files: `app/public/vendor/three.module.js`, `app/public/vendor/OrbitControls.js`.
- Upstream: https://github.com/mrdoob/three.js/tree/r160
- Licence: MIT; Copyright © 2010–2023 three.js authors.
- Full licence: `app/public/vendor/THREE-LICENSE.txt`.
- Local adjustment: OrbitControls imports the bundled `./three.module.js` rather than the npm bare specifier `three`. The architectural scene and interface are project code, not an upstream Three.js example.

## Floor Tiles 02

- Artist: Rob Tuytel / Poly Haven.
- Asset page: https://polyhaven.com/a/floor_tiles_02
- Licence: CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/
- Publisher's licence statement: https://polyhaven.com/license
- Original material repeat width: 4 m. The scene uses illustrative proportions rather than a surveyed scale.
- Bundled files: `app/public/assets/materials/limestone-color.jpg`, `limestone-normal.jpg`, `limestone-rough.jpg`.
- These filenames correspond to the original 1K diffuse, OpenGL normal and roughness maps; the files are renamed for the local scene.

Source URLs:

- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_tiles_02/floor_tiles_02_diff_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_tiles_02/floor_tiles_02_nor_gl_1k.jpg
- https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_tiles_02/floor_tiles_02_rough_1k.jpg

## Scene and venue data

The model is a representative shopping-mall reconstruction made for this prototype. It is not a model licensed from a real CP property, a photogrammetry survey, or an import of live indoor map data. Store names identify sample destinations and do not imply affiliation or endorsement. No OpenStreetMap, Google Maps, Wikimedia photograph or commercial indoor-mapping dataset is bundled in the v4 scene.
