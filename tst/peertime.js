/*
**  PeerTime -- Network Peer Time Synchronization
**  Copyright (c) 2018-2019 Dr. Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const PeerTime          = require("..")

const Chai              = require("chai")
const ChaiDeepMatch     = require("chai-deep-match")

const expect = Chai.expect
Chai.use(ChaiDeepMatch)

describe("PeerTime Library", () => {
    it("API structure", () => {
        const peertime = new PeerTime({
            send: (frame) => void frame
        })
        expect(peertime).to.respondTo("id")
        expect(peertime).to.respondTo("receive")
        expect(peertime).to.respondTo("sync")
        expect(peertime).to.respondTo("start")
        expect(peertime).to.respondTo("stop")
        expect(peertime).to.respondTo("now")
    })
    it("PeerTime base functionality", async () => {
        /* eslint no-console: off */
        let channel = []
        let peer1now = 0
        const peer1change = []
        const peer1 = new PeerTime({
            id:     "peer1",
            peers:  [ "peer2" ],
            repeat: 0,
            now:    () => peer1now,
            send:   async (frame) => {
                channel.push(frame)
                return peer2.receive(frame)
            }
        })
        peer1.on("change", (offset) => {
            peer1change.push(offset)
        })
        peer1.on("debug", (msg) => {
            //  console.log("DEBUG: peer1: " + msg)
        })
        let peer2now = 0
        const peer2change = []
        var peer2 = new PeerTime({
            id:     "peer2",
            peers:  [ "peer1" ],
            repeat: 0,
            now:    () => peer2now,
            send:   async (frame) => {
                channel.push(frame)
                return peer1.receive(frame)
            }
        })
        peer2.on("change", (offset) => {
            peer2change.push(offset)
        })
        peer2.on("debug", (msg) => {
            //  console.log("DEBUG: peer2: " + msg)
        })

        /*  first round  */
        await peer2.sync()
        await peer2.sync()
        expect(peer1.now()).to.be.equal(0)
        expect(peer2.now()).to.be.equal(0)
        expect(peer1change).to.be.deep.equal([])
        expect(peer2change).to.be.deep.equal([])
        expect(channel).to.be.deep.equal([
            { from: "peer2", to: "peer1", fid: 0,         type: "TIME-REQ" },
            { from: "peer1", to: "peer2", fid: 0, rid: 0, type: "TIME-RES", data: 0 },
            { from: "peer2", to: "peer1", fid: 1,         type: "TIME-REQ" },
            { from: "peer1", to: "peer2", fid: 1, rid: 1, type: "TIME-RES", data: 0 }
        ])

        /*  second round  */
        channel = []
        peer1now = 7
        peer2now = 42
        await peer2.sync()
        await peer2.sync()
        expect(peer1.now()).to.be.equal(7)
        expect(peer2.now()).to.be.equal(7)
        expect(peer1change).to.be.deep.equal([])
        expect(peer2change).to.be.deep.equal([ -(peer2now - peer1now) ])
        expect(channel).to.be.deep.equal([
            { from: "peer2", to: "peer1", fid: 2,         type: "TIME-REQ" },
            { from: "peer1", to: "peer2", fid: 2, rid: 2, type: "TIME-RES", data: peer1now },
            { from: "peer2", to: "peer1", fid: 3,         type: "TIME-REQ" },
            { from: "peer1", to: "peer2", fid: 3, rid: 3, type: "TIME-RES", data: peer1now }
        ])
    })
})

