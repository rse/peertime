
PeerTime
========

Network Peer Time Synchronization for Node.js and Browser.

<p/>
<img src="https://nodei.co/npm/peertime.png?downloads=true&stars=true" alt=""/>

<p/>
<img src="https://david-dm.org/rse/peertime.png" alt=""/>

About
-----

This is a small JavaScript library for Node.js and the Browser to
synchronize the time between networking peers by determining a
globally-aligned local time. This is inevitable in a network of peers
where exchanged data has to be locally timestamped with a globally
agreed time.

Algorithm
---------

PeerTime uses the following time synchronization protocol between a local node and
a peer node:

1. REQUEST: Local node stamps its current (potentially already globally aligned)
   local time and sends it in a `TIME-REQ` (request) data frame to a peer node.

2. RESPONSE: Upon receipt of the `TIME-REQ` frame, peer node stamps its
   current (potentially already globally aligned) local time and sends it
   in a `TIME-RES` (response) data frame to the local node.

3. ADJUSTMENT: Upon receipt of the `TIME-RES` frame, local node
   subtracts its current local time from the previously sent local time and
   divides it by two to compute network latency. It subtracts current local
   time from peer time to determine communication time delta and adds in
   the half-latency to get the correct local time offset.

The first determined clock offset is immediately be used to adjust the local time
since it will get the local time into at least the right ballpark.

The local node then repeats the above steps 1 through 3 a few times,
pausing a few seconds each time. Other network communication is allowed
in the interim, but should be minimized for best results.

The results of the determined local time offsets are accumulated and
sorted in a lowest-latency to highest-latency order. The median latency
is then determined by picking the mid-point sample from this ordered
list. All samples above approximately one standard-deviation from the
median are discarded and the remaining samples are averaged using an
arithmetic mean. In case of multiple peers, the arithmetic average of
the local time offset against all peers are taken as the final local
time offset.

Installation
------------

```shell
$ npm install peertime
```

Usage
-----

See the [TypeScript API definition](./src/peertime.d.ts) for all details
on the Application Programming Interface (API) of PeerTime.

Credits
-------

PeerTime was inspired by a similar library named
[timesync](https://github.com/enmasseio/timesync) and
PeerTime's underlying core synchronization algorithm was
derived from this library, which in turn derived it from the
[NTP](https://en.wikipedia.org/wiki/Network_Time_Protocol) and
[SNTP](http://www.mine-control.com/zack/timesync/timesync.html) time
synchronization protocols. The major difference between PeerTime and
[timesync](https://github.com/enmasseio/timesync) is that PeerTime
is fully agnostic to the network layer, both from a JavaScript API
perspective and NPM package dependency perspective and hence can be more
easily embedded into other frameworks or larger libraries.

License
-------

Copyright (c) 2018 Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

