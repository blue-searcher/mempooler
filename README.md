# mempooler

simple devp2p implementation to receive pending ethereum transactions and push them to websocket

websocket server runs on port 60606

port 30303 needs to be open from the outside in order to communicate with other ethereum nodes


### example

example tx pushed to websocket:

```json
{
	'chainId': '0x1', 
	'nonce': '0x0', 
	'maxPriorityFeePerGas': '0x3b9aca00', 
	'maxFeePerGas': '0x66e030349', 
	'gasLimit': '0xbcfd', 
	'to': '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3', 
	'value': '0x0', 
	'data': '0x5c19a95c00000000000000000000000078a8ae116443b61dadb88d186a0d9d6630f61259', 
	'accessList': [], 
	'v': '0x1', 
	'r': '0x4323a9f5339b686a61cb031fb6c84d5289024216fa1715b11cb80b671869f7d7', 
	's': '0x50d3eddfc3150f1c29845e1fcdd4166d45e8978c38c2c41fe9a3feedee5dae1b', 
	'from': '0xfad040759eebe2cdcec4b4e51de2d8173e1d94c5', 
	'txhash': '8437695e350a91e6db6cb12234e90906523949dbc4fe648d618589750bc44fda'
}
```