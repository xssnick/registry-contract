import {
    Address,
    CellMessage,
    CommonMessageInfo,
    InternalMessage,
    SendMode,
    toNano,
    TupleSlice,
    WalletContract
} from "ton";
import {buildRegistryDataCell, Queries, Verifier} from "../packages/contracts/registry-contract/RegistryData";
import BN from "bn.js";
import {randomKeyPair} from "../packages/utils/randomKeyPair";

// return the init Cell of the contract storage (according to load_data() contract method)
export function initData() {
    return buildRegistryDataCell({
        verifiers: new Map<BN, Verifier>()
    }, 0)
}

// return the op that should be sent to the contract on deployment, can be "null" to send an empty message
export function initMessage() {
    return null;
}

// optional end-to-end sanity test for the actual on-chain contract to see it is actually working on-chain
export async function postDeployTest(walletContract: WalletContract, secretKey: Buffer, contractAddress: Address) {
    const call = await walletContract.client.callGetMethod(contractAddress, "get_verifiers_num");
    let ts = new TupleSlice(call.stack);
    console.log(`   # Getter 'get_verifiers_num' = ${ts.readNumber()}`);
/*
    let kp = await randomKeyPair()
    let kp2 = await randomKeyPair()
    let kp3 = await randomKeyPair()

    const seqno = await walletContract.getSeqNo();
    const transfer = walletContract.createTransfer({
        secretKey: secretKey,
        seqno: seqno,
        sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
        order: new InternalMessage({
            to: contractAddress,
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
              //  body: new CellMessage(Queries.removeVerifier({
               //     id: new BN(717),
             //   }))
                body: new CellMessage(Queries.updateVerifier({
                    id: new BN(77187),
                    quorum: 2,
                    endpoints: new Map<BN, number>([
                        [new BN(kp.publicKey), 1],
                        [new BN(kp2.publicKey), 2],
                        [new BN(kp3.publicKey), 3]
                    ])
                }))
            }),
        }),
    });
    await walletContract.client.sendExternalMessage(walletContract, transfer);

    console.log(`   # Message sent`);
 */
}