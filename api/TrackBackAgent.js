const { ApiPromise, WsProvider } = require('@polkadot/api');
const blake2AsHex = require('@polkadot/util-crypto');
const { Keyring } = require('@polkadot/keyring');
const str2ab = require('string-to-arraybuffer');
const { v4: uuidv4 } = require('uuid');
const BN = require('bn.js');

const utils = {
    paramConversion: {
        num: [
            'Compact<Balance>',
            'BalanceOf',
            'u8', 'u16', 'u32', 'u64', 'u128',
            'i8', 'i16', 'i32', 'i64', 'i128'
        ]
    }
};

const isNumType = type => utils.paramConversion.num.some(el => type.indexOf(el) >= 0);


class TrakBackAgent {

    async connect() {
        const provider = new WsProvider("wss://trackback.dev");

        const types = {
            "VerifiableCredential": {
                "account_id": "AccountId",
                "public_key": "Vec<8>",
                "block_time_stamp": "u64",
                "active": "bool"
            },
            "DID": {
                "did_uri": "Vec<u8>",
                "did_document": "Vec<u8>",
                "block_number": "BlockNumber",
                "block_time_stamp": "u64",
                "did_ref": "Vec<u8>",
                "sender_account_id": "AccountId",
                "active": "Option<bool>"
            }
        };

        const rpc = {
            "didModule": {
                "dIDDocument": {
                    "description": "Get DID Documnet",
                    "params": [
                        {
                            "name": "didDocumentHash",
                            "type": "Vec<u8>"
                        }
                    ],
                    "type": "DID"
                }
            }
        };

        this.api = await ApiPromise.create({ provider: provider, types, rpc });
        return this.api;

    }

    transformParams(paramFields, inputParams, opts = { emptyAsNull: true }) {
        const paramVal = inputParams.map(inputParam => {
            if (typeof inputParam === 'object' && inputParam !== null && typeof inputParam.value === 'string') {
                return inputParam.value.trim();
            } else if (typeof inputParam === 'string') {
                return inputParam.trim();
            }
            return inputParam;
        });
        const params = paramFields.map((field, ind) => ({ ...field, value: paramVal[ind] || null }));

        return params.reduce((memo, { type = 'string', value }) => {
            if (value == null || value === '') return (opts.emptyAsNull ? [...memo, null] : memo);

            let converted = value;

            if (type.indexOf('Vec<') >= 0) {
                converted = converted.split(',').map(e => e.trim());
                converted = converted.map(single => isNumType(type)
                    ? (single.indexOf('.') >= 0 ? Number.parseFloat(single) : Number.parseInt(single))
                    : single
                );
                return [...memo, converted];
            }

            // Deal with a single value
            if (isNumType(type)) {
                converted = converted.indexOf('.') >= 0 ? Number.parseFloat(converted) : Number.parseInt(converted);
            }
            return [...memo, converted];
        }, []);
    }


    createDID() {

        const did_uri = "did" + ":" + blake2AsHex.blake2AsHex("trackback.dev").substring(0, 8) + ":" + uuidv4();
        const didDocument = { "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/ed25519-2020/v1"], "id": `${did_uri}`, "assertionMethod": [{ "id": "did:trackback.dev:dia-0x12345678999", "type": "Ed25519VerificationKey2020", "controller": "did:trackback.dev:dia-0x1234567890", "publicKeyMultibase": "MCowBQYDK2VwAyEAgh8ef957I18rSmje4IMASKPo8XAm+MlDXvGSn6OfQlc=" }] };

        return {
            didDocument,
            did_uri
        }

    }

    async addDidToChain(account, didDocument, did_uri) {

        var binaryArray = str2ab(JSON.stringify(didDocument))
        var didDocument = Array.from(new Uint8Array(binaryArray))

        const palletRpc = "didModule";
        const callable = "insertDidDocument";

        const inputParams = [didDocument, did_uri];
        const paramFields = [true, true];

        const transformed = this.transformParams(paramFields, inputParams);

        return await this.save(account, palletRpc, callable, transformed);

    }


    async addVCPhashToChain(account, vcHash, publicKey) {

        var vcp = Array.from(new Uint8Array(str2ab(blake2AsHex.blake2AsHex(JSON.stringify(vcHash)))))
        console.log(vcp)
        var publicKey =  Array.from(new Uint8Array(str2ab(publicKey)))

        const palletRpc = "didModule";
        let callable = "createVcFingerprint";

        let inputParams = [publicKey, vcp, true];
        let paramFields = [true, true, true];

        const transformed = this.transformParams(paramFields, inputParams);
    
        return await this.save(account, palletRpc, callable, transformed);

    }


    async save(account, palletRpc, callable, transformed) {

        const nonce = await this.api.rpc.system.accountNextIndex(account.address);

        const txExecute = this.api.tx[palletRpc][callable](...transformed);

        return await new Promise((resolve, reject) => {

            txExecute.signAndSend(account, {nonce}, (result) => {

                console.log(`Current status is ${result.status}`);
                console.log((`Current nonce is ${nonce}`))

                if (result.status.isInBlock) {
                    console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
                } else if (result.status.isFinalized) {
                    console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                    resolve(result.status.isFinalized)
                }
            }
            )
        }).catch((error) => {
            console.log(error)
        })
    }

}


module.exports = {
    TrackBackAgent: new TrakBackAgent()
}