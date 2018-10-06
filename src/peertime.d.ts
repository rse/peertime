/*!
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

declare module "peertime" {
    /*  the interface of a data frame  */
    interface PeerTimeFrame {
        fid?: string,                             /*  frame id  */
        rid?: string,                             /*  reply (frame) id  */
        from: string,                             /*  sender peer id */
        to: string,                               /*  receiver peer id */
        type: string,                             /*  type of frame  */
        data?: any,                               /*  payload of frame  */
    }

    /*  the primary API class  */
    class PeerTime {
        /*  the constructor of the API class  */
        public constructor(options?: {
            id: string,                           /*  the id of this peer  */
            peers: string[],                      /*  the ids of the remote peers   */
            interval: number,                     /*  interval for doing automatic synchronizations (in ms)  */
            timeout: number,                      /*  timeout for requests to fail (in ms)  */
            delay: number,                        /*  delay between requests (in ms)  */
            repeat: number,                       /*  number of times to do a request to one peer  */
            now: () => number,                    /*  return the local system time (in ms)  */
            send: (frame: PeerTimeFrame) => void  /*  send a frame to a remote peer  */
        })

        /*  event emitting facility  */
        public on(
            name: string,                         /*  name of event  */
            handler: (data: any) => void          /*  callback handler of event  */
            context?: any                         /*  context (this) of event handler  */
        ): void
        public once(
            name: string,                         /*  name of event  */
            handler: (data: any) => void          /*  callback handler of event  */
            context?: any                         /*  context (this) of event handler  */
        ): void
        public removeListener(
            name: string,                         /*  name of event  */
            handler: (data: any) => void          /*  callback handler of event  */
            context?: any                         /*  context (this) of event handler  */
        ): void

        /*  retrieve the id of the local peer */
        public id(): string

        /*  inject a frame, received from remote peer */
        public receive(frame: PeerTimeFrame): void

        /*  trigger manual synchronization  */
        public sync(): Promise<any>

        /*  start automatic synchronization  */
        public start(): void

        /*  stop automatic synchronization  */
        public stop(): void

        /*  retrieve the (globally aligned) time of the local peer */
        public now(): number
    }

    /*  the export of the API class  */
    const peertime: PeerTime
    export = peertime
}

