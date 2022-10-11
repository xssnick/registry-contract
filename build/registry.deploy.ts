import { Address, toNano, TupleSlice, WalletContract } from "ton";
import {buildRegistryDataCell, Verifier} from "../packages/contracts/registry-contract/RegistryData";
import BN from "bn.js";

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
}