/*
**  PeerTime -- Network Peer Time Synchronization
**  Copyright (c) 2018 Ralf S. Engelschall <rse@engelschall.com>
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

/*  external dependencies  */
import UUID         from "pure-uuid"
import EventEmitter from "eventemitter3"

/*
 *  ==== Ssynchronous Programming Utilities ====
 */

/*  sleep for a certain time  */
const sleep = (delay) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), delay)
    })
}

/*  repeat as long as a condition holds  */
const whilst = (condition, callback) => {
    return new Promise((resolve, reject) => {
        const recurse = () =>
            condition() ? callback().then(() => recurse()) : resolve()
        recurse()
    })
}

/*
 *  ==== Statistics Utilities ====
 */

/*  the arithmetical mean  */
const mean = (arr) =>
    arr.reduce((a, b) => a + b) / arr.length

/*  the variance (squared deviation from the mean)  */
const variance = (arr) => {
    if (arr.length < 2)
        return 0
    let _mean = mean(arr)
    return arr
        .map((x) => Math.pow(x - _mean, 2))
        .reduce((a, b) => a + b) / (arr.length - 1)
}

/*  the standard deviation (square root of the variance)  */
const std = (arr) =>
    Math.sqrt(variance(arr))

/*  the median (middle value of an ordered set)  */
const median = (arr) => {
    if (arr.length < 2)
        return arr[0]
    let sorted = arr.slice()
        .sort((a, b) => a > b ? 1 : (a < b ? -1 : 0))
    if (sorted.length % 2 === 0)
        return (sorted[arr.length / 2 - 1] + sorted[arr.length / 2]) / 2
    else
        return sorted[(arr.length - 1) / 2]
}

/*
 *  ==== the Application Programming Interface (API) ====
 */

/*  the exported API class  */
module.exports = class PeerTime extends EventEmitter {
    constructor (options = {}) {
        /*  initialize base class  */
        super()

        /*  determine options  */
        this.options = Object.assign({}, {
            id:       (new UUID(1)).format(), /* the id of this peer */
            peers:    [],                     /* the ids of the remote peers  */
            interval: 2 * 1000,               /* interval for doing automatic synchronizations (in ms) */
            timeout:  10 * 1000,              /* timeout for requests to fail (in ms) */
            delay:    0.1 * 1000,             /* delay between requests (in ms) */
            repeat:   5,                      /* number of times to do a request to one peer */
            now:      () => Date.now(),       /* return the local system time (in ms) */
            send:     null                    /* send a frame to a remote peer */
        }, options)
        if (this.options.send === null)
            throw new Error("mandatory send operation not configured")

        /*  initialize time offset  */
        this.offset   = 0

        /*  initialize interval timer and progress flag  */
        this.timer    = null
        this.progress = false
        this.first    = true

        /*  initialize RPC facility  */
        this.fid      = 0
        this.rpccb    = {}
    }

    /*  return the identifier of this peer  */
    id () {
        return this.options.id
    }

    /*  receive the datagram of a peer  */
    receive (frame) {
        /*  sanity check received frame  */
        if (typeof frame !== "object")
            throw new Error("invalid frame argument")
        if (typeof frame.fid !== "number")
            throw new Error("received unexpected frame type (no frame id found)")
        if (typeof frame.type !== "string")
            throw new Error("received unexpected frame type (no frame type found)")

        /*  process frame  */
        if (typeof frame.rid === "number") {
            /*  frame is a response/reply  */
            if (!(frame.rid in this.rpccb))
                throw new Error("unexpected frame type (invalid reply id)")
            this.emit("debug", `receive (response) frame: ${JSON.stringify(frame)}`)

            /*  deferred execution of RPC callback  */
            this.rpccb[frame.rid](frame)
        }
        else if (frame.type === "TIME-REQ") {
            /*  frame is a request  */
            this.emit("debug", `receive (request) frame: ${JSON.stringify(frame)}`)

            /*  reply with local time  */
            let reply = {
                fid:  this.fid++,
                rid:  frame.fid,
                from: this.id(),
                to:   frame.from,
                type: "TIME-RES",
                data: this.now()
            }
            this.emit("debug", `send (response) frame: ${JSON.stringify(reply)}`)
            try { this.options.send(reply, this.options.timeout) }
            catch (err) { /* no-op */ }
        }
        else
            throw new Error("received unexpected frame (invalid frame type)")
    }

    /*  trigger a synchronization with all peers  */
    async sync () {
        this.emit("debug", "begin synchronization with all peers")

        /*  perform a request/response operation pair  */
        const _rpc = (frame) => {
            return new Promise((resolve, reject) => {
                /*  determine new unique frame id  */
                let fid = this.fid++

                /*  provide callback for deferred response handling  */
                this.rpccb[fid] = (frame) => {
                    /*  cleanup callback  */
                    delete this.rpccb[fid]

                    /*  cleanup frame  */
                    frame = Object.assign({}, frame)
                    delete frame.fid
                    delete frame.rid

                    /*  return frame as the result  */
                    resolve(frame)
                }

                /*  send request frame  */
                let result
                try {
                    /*  add frame id  */
                    frame = Object.assign({}, frame, { fid })

                    /*  send the frame  */
                    this.emit("debug", `send (request) frame: ${JSON.stringify(frame)}`)
                    result = this.options.send(frame, this.options.timeout)
                }
                catch (err) {
                    /*  catch synchronous errors  */
                    reject(err)
                }
                if (!(result && result instanceof Promise))
                    throw new Error("send callback has to return a Promise")
                result.catch((err) => {
                    /*  catch asynchronous errors  */
                    reject(err)
                })
            })
        }

        /*  determine time offset for a single peer via RPC  */
        const _getOffset = (peer) => {
            /*  determine start time  */
            let start = this.options.now()

            /*  create and send request frame  */
            let frame = {
                from: this.id(),
                to:   peer,
                type: "TIME-REQ"
            }
            return _rpc(frame).then((frame) => {
                /*  determine end time and roundtrip duration  */
                let end = this.options.now()
                let roundtrip = end - start

                /*  determine remote peer time and local peer offset  */
                let timestamp = frame.data
                let offset = Math.trunc(timestamp - end + roundtrip / 2)
                this.emit("debug", `determined offset ${this.offset} against peer ${peer}`)

                /*  apply the first ever retrieved offset immediately  */
                if (this.first) {
                    this.first = false
                    if (this.offset !== offset) {
                        this.offset = offset
                        this.emit("change", this.offset)
                        this.emit("debug", `changed local time offset to ${this.offset} (first time)`)
                    }
                }

                /*  return the retrieved information  */
                return { peer, roundtrip, offset }
            }).catch((/* err */) => {
                /*  just mark error cases  */
                return null
            })
        }

        /*  perform a synchronization with a single peer  */
        const _syncWithPeer = (peer) => {
            /*  assemble all offsets  */
            let all = []

            /*  perform a single synchronization operation  */
            const sync = () =>
                _getOffset(peer).then((result) => all.push(result))

            /*  repeat the synchroniation operation multiple times  */
            return sync()
                .then(() => {
                    return whilst(
                        () => all.length < this.options.repeat,
                        () => sleep(this.options.delay).then(sync))
                })
                .then(() => {
                    /*  filter out results marked as error  */
                    let results = all.filter((result) => result !== null)

                    /*  calculate the limit for outliers  */
                    let roundtrips = results.map((result) => result.roundtrip)
                    let limit = median(roundtrips) + std(roundtrips)

                    /*  filter all results which have a roundtrip smaller or equal than the limit  */
                    let limited = results.filter((result) => result.roundtrip <= limit)
                    let offsets = limited.map((result) => result.offset)

                    /*  return the mean from the limited offsets  */
                    return (offsets.length > 0 ? mean(offsets) : null)
                })
        }

        /*  perform synchronization with all peers  */
        return Promise.all(this.options.peers.map((peer) => _syncWithPeer(peer)))
            .then((all) => {
                /*  filter out results marked as error or which are invalid numbers  */
                let offsets = all.filter((offset) => (offset !== null && !isNaN(offset) && isFinite(offset)))

                /*  pick the mean of all peer offsets  */
                if (offsets.length > 0) {
                    let newOffset = Math.trunc(mean(offsets))
                    if (this.offset !== newOffset) {
                        this.offset = newOffset
                        this.emit("change", this.offset)
                        this.emit("debug", `changed local time offset to ${this.offset}`)
                    }
                }
                this.emit("debug", "end synchronization with all peers")
            })
    }

    /*  start automatic synchronization  */
    start () {
        if (this.timer !== null)
            throw new Error("automatic synchronization already enabled")
        this.emit("debug", "start automatic synchronization")
        this.timer = setInterval(async () => {
            if (this.progress)
                return
            this.progress = true
            await this.sync()
            this.progress = false
        }, this.options.interval)
    }

    /*  stop automatic synchronization  */
    stop () {
        if (this.timer === null)
            throw new Error("synchronization not running")
        this.emit("debug", "end automatic synchronization")
        clearTimeout(this.timer)
        this.timer = null
    }

    /*  return the peer-aligned "global" time  */
    now () {
        let now = Math.trunc(this.options.now())
        now += this.offset
        return now
    }
}

