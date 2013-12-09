## ows10

This repo is for the work performed by Cloudant as part of the OGC [OWS10](http://www.opengeospatial.org/projects/initiatives/ows-10) geopackage experiment, this repo represents work for discussion.

Cloudant docs will be in Markdown where possible and converted to AsciiDoc using [Pandoc](http://johnmacfarlane.net/pandoc/).

## Overview

This repo is focused on the the Open Mobility thread, in particular, the deliverable of the GeoPackage Engineering Report and the GeoPackaging Service Reference Implementation. 

In the discussions at the OWS10 kickoff it was recognised that delivering a geosynchronisation service is an important part of GeoPackage that needs to be addressed. The GeoPackaging Service will create an initial GeoPackage and subsequently synchronization will keep the the GeoPackage up to date.

## Hub/Spoke and P2P

As the focus is on mobility / deployment in austere environments, it is necessary to address whether a push or subscription architecture is relevant. Both architectures are relevant, however the benefits of a subscription architecture is well understood, it avoids network lockup and the data is always available even if not consistent with the master record. The ideal of everyone having a copy of the same data at the same time is not realistic in real-time, however depending on the definition of near real time, typically Cloudant have found that data is consistent within a few seconds when the network is available.

The architecture for austere environments needs to include the requirements of users and systems being disconnected for periods of time, or even lost. This architecture is best described as being eventually consistent. When the user or system reconnects they are updated and locally they are consistent with the best record of the data until they reconnect to the network again.

Hub/Spoke and P2P are identical if P2P systems include gate-keepers and the notion of a master record (document). The discussion against peer to peer systems seems to be centred on what is the master reference for a document in conflict between users and systems. [MVCC](http://en.wikipedia.org/wiki/Multiversion_concurrency_control) is a concurrent control access method that raises conflicts between documents, a mediation service (the hub) even if manual could establish the master in this case.

Cloudant is focused on eventually consistent / masterless systems because this is the key for us in delivering a highly available and partition tolerant database as a service.

The key to deciding the final document is a unique document identifier and a revision tree (lineage), this is the same in a P2P and Hub/Spoke architecture. Who authored the document and what changes did they and others make. A revision tree provides an audit history for a document. 

In a hub spoke architecture this becomes conceptually simpler, the hub is the master. However in use this is not the case, often the hub is a coalition of interested stakeholders, each of whom are authorative. The hub system is itself peer to peer.

In summary P2P and Hub/Spoke are the same problem, a focus on revision tree preservation is the most important in defining documents.

## Links

[NodeJS WPS](wps.md)

## Work TODO

* Define JSON changes feed,[http://guide.couchdb.org/draft/notifications.html](this is a good start)
* A simple implementation based on [PouchDB](http://pouchdb.com/)
* Release Cloudant Java code for android users
* Define use cases, I can think of several, however I need to get releases for them.
* Define GML/GeoSynchronization feed

## Licensing

Copyright 2013 Cloudant

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [license.txt]( https://raw.github.com/Cloudant/geopackage/master/license.txt) file.










