GeoPackage WPS
===============

## Requirements

* [NodeJS](http://nodejs.org/download/)
* [Grunt](http://gruntjs.com/getting-started)
* [libgpkg](https://bitbucket.org/luciad/libgpkg/src) 
	- installed as a system library in /usr/local/lib and the shared library linked as 'libgpkg.ext' in /usr/local/lib/ 
	  e.g. on a Mac `ln -s libgpkg.dylib libgpkg.sqlext`

Then execute

`npm install` in the root directory.
`grunt test` in the root directory to run tests.

`node app.js` to run the server.

## Samples

Execute from the root directory

`curl "http://localhost:1337/wps?request=getcapabilities&version=1.0.0&service=wps"`
`curl "http://localhost:1337/wps?request=describeprocess&version=1.0.0&service=wps"`
`curl -d @samples/execute.xml http://localhost:1337/wps > shapefile.gpkg`
`curl -d @samples/wfs_execute.xml http://localhost:1337/wps > wfs.gpkg`














