import {SmartContract} from "ton-contract-executor";
import {buildRegistryDataCell, RegistryData} from "./RegistryData";
import {Address, Cell, contractAddress, Slice, toNano} from "ton";
import BN from "bn.js";
import { hex } from "../../../build/registry.compiled.json";

export class RegistryLocal {
    private constructor(
        public readonly contract: SmartContract,
        public readonly address: Address
    ) {

    }

    //
    // Get methods
    //

    async getVerifier(id: BN): Promise<{ admin: Address | null, settings: Cell | null }> {
        let res = await this.contract.invokeGetMethod('get_verifier', [{
            type: 'int',
            value: id.toString(10)
        }])
        if (res.exit_code !== 0) {
            throw new Error(`Unable to invoke get_verifier on contract`)
        }
        let [sl, settings, ok] = res.result as [Slice, Cell, BN];
        if (ok.toNumber() == 0) {
            return {
                admin: null,
                settings: null
            }
        }

        return {
            admin: sl.readAddress(),
            settings,
        }
    }

    async getVerifiersNum(): Promise<number> {
        let res = await this.contract.invokeGetMethod('get_verifiers_num', [])
        if (res.exit_code !== 0) {
            throw new Error(`Unable to invoke get_verifier on contract`)
        }
        let [num] = res.result as [BN];

        return num.toNumber()
    }

    //
    // Internal messages
    //

    static async createFromConfig(config: RegistryData, num?:number) {
        let data = buildRegistryDataCell(config,num)
        let contract = await SmartContract.fromCell(Cell.fromBoc(hex)[0], data, {
            debug: true
        })
        let address = contractAddress({
            workchain: 0,
            initialData: contract.dataCell,
            initialCode: contract.codeCell
        })

        contract.setC7Config({
            balance: toNano(1),
            myself: address,
            randSeed: new BN(1),
            transLt: 7,
            unixtime: 1000,
        })

        return new RegistryLocal(contract, address)
    }
}