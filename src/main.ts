import { randomBytes } from 'crypto'
import { Block, BlockHeader } from '@ethereumjs/block'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { RLP } from '@ethereumjs/rlp'
import { TransactionFactory, TypedTransaction } from '@ethereumjs/tx'
import { arrToBufArr, bufferToHex } from '@ethereumjs/util'
import chalk from 'chalk'
import * as LRUCache from 'lru-cache'
import ms = require('ms')

import * as devp2p from '@ethereumjs/devp2p'
import { ETH, Peer } from '@ethereumjs/devp2p'

import { WebSocketServer, WebSocket } from 'ws';


const PRIVATE_KEY = randomBytes(32)
const getPeerAddr = (peer: Peer) => `${peer._socket.remoteAddress}:${peer._socket.remotePort}`

const wss = new WebSocketServer({ port: 60606 });

let sockets: WebSocket[] = [];

const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Merge })
const BOOTNODES = common.bootstrapNodes().map((node: any) => {
  return {
    address: node.ip,
    udpPort: node.port,
    tcpPort: node.port,
  }
})

const dpt = new devp2p.DPT(PRIVATE_KEY, {
  refreshInterval: 30000,
  endpoint: {
    address: '0.0.0.0',
    udpPort: null,
    tcpPort: null,
  },
})
dpt.on('error', (err) => {
  if (err?.message !== "Peer is banned") {
    console.error(chalk.red(`DPT error: ${err}`))
  }
})

const rlpx = new devp2p.RLPx(PRIVATE_KEY, {
  dpt,
  maxPeers: 50,
  capabilities: [devp2p.ETH.eth66],
  common,
})
rlpx.on('error', (err) => console.error(chalk.red(`RLPx error: ${err.stack ?? err}`)))

wss.on('connection', (s: WebSocket) => {
  console.log("New ws connection");
  sockets.push(s);
});

rlpx.on('peer:added', (peer) => {
  const addr = getPeerAddr(peer)
  const eth = peer.getProtocols()[0]
  const requests: {
    headers: any[]
    bodies: any[]
    msgTypes: { [key: string]: ETH.MESSAGE_CODES }
  } = { headers: [], bodies: [], msgTypes: {} }

  const clientId = peer.getHelloMessage().clientId
  console.log(
    chalk.green(
      `Add peer: ${addr} ${clientId} (eth${eth.getVersion()}) (total: ${rlpx.getPeers().length})`
    )
  )

  eth.sendStatus({
    td: devp2p.int2buffer(17179869184), // total difficulty in genesis block
    bestHash: Buffer.from(
      'd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
      'hex'
    ),
    genesisHash: Buffer.from(
      'd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
      'hex'
    ),
  })

  eth.on('message', async (code: ETH.MESSAGE_CODES, payload: any) => {
    if (code in ETH.MESSAGE_CODES) {
      requests.msgTypes[code] = code + 1
    } else {
      requests.msgTypes[code] = 1
    }

    switch (code) {
      case devp2p.ETH.MESSAGE_CODES.TX:
        for (const item of payload) {
          const tx = TransactionFactory.fromBlockBodyData(item)
          if (tx.validate()) {
            onNewTx(tx, peer)
          }
        }

        break
    }
  })
})

rlpx.on('peer:removed', (peer, reasonCode, disconnectWe) => {
  const who = disconnectWe === true ? 'we disconnect' : 'peer disconnect'
  const total = rlpx.getPeers().length
  console.log(
    chalk.yellow(
      `Remove peer: ${getPeerAddr(peer)} - ${who}, reason: ${peer.getDisconnectPrefix(
        reasonCode
      )} (${String(reasonCode)}) (total: ${total})`
    )
  )
})

rlpx.on('peer:error', (peer, err) => {
  if (err.code === 'ECONNRESET') return

  if (err instanceof Error) {
    const peerId = peer.getId()
    if (peerId !== null) dpt.banPeer(peerId, ms('5m'))

    console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.message}`))
    return
  }

  console.error(chalk.red(`Peer error (${getPeerAddr(peer)}): ${err.stack ?? err}`))
})

rlpx.listen(30303, '0.0.0.0')
dpt.bind(30303, '0.0.0.0')

for (const bootnode of BOOTNODES) {
  dpt.bootstrap(bootnode).catch((err) => {
    console.error(chalk.bold.red(`DPT bootstrap error: ${err.stack ?? err}`))
  })
}

const txCache = new LRUCache({ max: 5000 })
function onNewTx(tx: TypedTransaction, peer: Peer) {
  const txHashHex = tx.hash().toString('hex')
  if (txCache.has(txHashHex)) {
    return
  }

  txCache.set(txHashHex, true)
  console.log(`New tx: ${txHashHex} (from ${getPeerAddr(peer)})`)

  if (sockets.length > 0) {
    for (let socket of sockets) {
      if (socket) {
        socket.send(JSON.stringify({ 
          ...tx.toJSON(), 
          from: tx.getSenderAddress().toString(),
          txhash: txHashHex 
        }))
      }
    }
  }
  else {
    console.log("sockets not found")
  }
}

setInterval(() => {
  const peersCount = dpt.getPeers().length
  const openSlots = rlpx._getOpenSlots()
  const queueLength = rlpx._peersQueue.length
  const queueLength2 = rlpx._peersQueue.filter((o) => o.ts <= Date.now()).length

  console.log(
    chalk.yellow(
      `Total nodes in DPT: ${peersCount}, open slots: ${openSlots}, queue: ${queueLength} / ${queueLength2}`
    )
  )
}, ms('30s'))
