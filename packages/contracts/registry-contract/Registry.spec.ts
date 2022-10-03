import {
    RegistryData,
    Verifier, Queries, buildMsgDescription
} from "./RegistryData";
import {
    Cell,
    CellMessage,
    CommonMessageInfo,
    InternalMessage,
    toNano,
} from "ton";
import {RegistryLocal} from "./RegistryLocal";
import {randomAddress} from "../../utils/randomAddress";
import {ReserveCurrencyAction, SendMsgAction} from "ton-contract-executor";
import BN from "bn.js";
import {randomKeyPair} from "../../utils/randomKeyPair";
import {beginCell} from "ton/dist";
import {sign} from "ton-crypto";

const ADMIN1_ADDRESS = randomAddress()

async function genDefaultConfig() {
    let kp = await randomKeyPair()
    let kp2 = await randomKeyPair()
    let kp3 = await randomKeyPair()
    return {
        keys: [kp,kp2,kp3],
        data: {
            verifiers: new Map<BN, Verifier>([
                [new BN(222), {
                    admin: ADMIN1_ADDRESS,
                    quorum: 2,
                    pub_key_endpoints: new Map<BN, number>([
                        [new BN(kp.publicKey), 999],
                        [new BN(kp2.publicKey), 555],
                        [new BN(kp3.publicKey), 1212]
                    ])
                }]
            ])
        } as RegistryData,
    }
}

describe('registry smc', () => {
    it('should add new verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let user = randomAddress();

        let kp3 = await randomKeyPair()

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: user,
            value: toNano(10005),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.updateVerifier({
                        id: new BN(123),
                        quorum: 7,
                        endpoints: new Map<BN, number>([
                            [new BN(kp3.publicKey), 321]
                        ]),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(0)
        expect(res.type).toEqual("success")

        let data = await contract.getVerifier(new BN(123));
        let sets = (data.settings as Cell).beginParse()
        let quorum = sets.readUint(8);
        let settings = sets.readDict<number>(256, function (slice) {
            return slice.readUint(32).toNumber();
        });
        let ip = settings.get(new BN(kp3.publicKey).toString());

        console.log(res.gas_consumed)
        expect(data.admin?.toFriendly()).toEqual(user.toFriendly())
        expect(ip).toEqual(321)
        expect(quorum.toNumber()).toEqual(7)

        let reserve = res.actionList[0] as ReserveCurrencyAction
        expect(reserve.currency.coins.toNumber()).toEqual(toNano(1 + 10000).toNumber())

        let excess = res.actionList[1] as SendMsgAction
        expect(excess.message.info.dest?.toFriendly()).toEqual(user.toFriendly())
        expect(excess.mode).toEqual(128 + 2)

        let body = excess.message.body.beginParse();
        expect(body.readUint(32).toNumber()).toEqual(0)
        expect(body.readBuffer(body.remaining/8).toString()).toEqual("You were successfully registered as a verifier")
    })

    it('should update verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)

        let kp3 = await randomKeyPair()

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: ADMIN1_ADDRESS,
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.updateVerifier({
                        id: new BN(222),
                        quorum: 7,
                        endpoints: new Map<BN, number>([
                            [new BN(kp3.publicKey), 321]
                        ]),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(0)
        expect(res.type).toEqual("success")

        let data = await contract.getVerifier(new BN(222));
        let sets = (data.settings as Cell).beginParse();
        let quorum = sets.readUint(8);
        let settings = sets.readDict<number>(256, function (slice) {
            return slice.readUint(32).toNumber();
        });
        let ip = settings.get(new BN(kp3.publicKey).toString());

        console.log(res.gas_consumed)
        expect(data.admin?.toFriendly()).toEqual(ADMIN1_ADDRESS.toFriendly())
        expect(ip).toEqual(321)
        expect(quorum.toNumber()).toEqual(7)

        let excess = res.actionList[0] as SendMsgAction
        expect(excess.message.info.dest?.toFriendly()).toEqual(ADMIN1_ADDRESS.toFriendly())
        expect(excess.mode).toEqual(64 + 2)

        let body = excess.message.body.beginParse();
        expect(body.readUint(32).toNumber()).toEqual(0)
        expect(body.readBuffer(body.remaining/8).toString()).toEqual("You successfully updated verifier data")
    })

    it('should not update verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)

        let kp3 = await randomKeyPair()

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: randomAddress(),
            value: toNano(10000),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.updateVerifier({
                        id: new BN(222),
                        quorum: 7,
                        endpoints: new Map<BN, number>([
                            [new BN(kp3.publicKey), 321]
                        ]),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(401)
    })

    it('should not add verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)

        let kp3 = await randomKeyPair()

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: randomAddress(),
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.updateVerifier({
                        id: new BN(223),
                        quorum: 7,
                        endpoints: new Map<BN, number>([
                            [new BN(kp3.publicKey), 321]
                        ]),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(410)
    })

    it('should remove verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: ADMIN1_ADDRESS,
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.removeVerifier({
                        id: new BN(222),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(0)
        expect(res.type).toEqual("success")

        let exit = res.actionList[0] as SendMsgAction
        expect(exit.message.info.dest?.toFriendly()).toEqual(ADMIN1_ADDRESS.toFriendly())
        expect(exit.message.info.type).toEqual("internal")
        if (exit.message.info.type === "internal") {
            expect(exit.message.info.value.coins.toNumber()).toEqual(toNano(10000).sub(toNano("0.2")).toNumber())
        }
        expect(exit.mode).toEqual(64)

        let body = exit.message.body.beginParse();
        expect(body.readUint(32).toNumber()).toEqual(0)
        expect(body.readBuffer(body.remaining/8).toString()).toEqual("Withdrawal and exit from the verifier registry")

        let data = await contract.getVerifier(new BN(222));
        expect(data.settings).toEqual(null)
    })

    it('should not remove verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: randomAddress(),
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.removeVerifier({
                        id: new BN(222),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(401)
    })

    it('should not remove verifier, not found', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: randomAddress(),
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.removeVerifier({
                        id: new BN(223),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(404)
    })

    it('should forward message', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 1500, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                        [new BN(cfg.keys[1].publicKey), sign(desc.hash(), cfg.keys[1].secretKey)]
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(0)
        expect(res.type).toEqual("success")

        let excess = res.actionList[0] as SendMsgAction
        expect(excess.message.info.dest?.toFriendly()).toEqual(dst.toFriendly())
        expect(excess.mode).toEqual(64)

        let body = excess.message.body.beginParse();
        expect(body.readUint(32).toNumber()).toEqual(777)
    })

    it('should forward message, 2 out of 3 correct, quorum = 2', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 1500, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                        [new BN(cfg.keys[1].publicKey), sign(desc.hash(), cfg.keys[1].secretKey)],
                        [new BN(cfg.keys[2].publicKey), sign(desc.hash(), cfg.keys[1].secretKey)]
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(0)
        expect(res.type).toEqual("success")

        let excess = res.actionList[0] as SendMsgAction
        expect(excess.message.info.dest?.toFriendly()).toEqual(dst.toFriendly())
        expect(excess.mode).toEqual(64)

        let body = excess.message.body.beginParse();
        expect(body.readUint(32).toNumber()).toEqual(777)
    })

    it('should not forward message, 1 sign of 2', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 1500, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(413)
    })

    it('should not forward message, 2 same signs', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 1500, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(413)
    })

    it('should not forward message, no signs', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 1500, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([

                    ]),
                }))
            }),
        }))

        expect(res.type).toEqual("failed")
    })

    it('should not forward message, 2 signs, 1 invalid', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 1500, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                        [new BN(cfg.keys[1].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)]
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(413)
    })

    it('should not forward message, expired', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 999, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                        [new BN(cfg.keys[1].publicKey), sign(desc.hash(), cfg.keys[1].secretKey)]
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(411)
    })

    it('should not forward message, wrong sender', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(222), 1500, randomAddress(), dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                        [new BN(cfg.keys[1].publicKey), sign(desc.hash(), cfg.keys[1].secretKey)]
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(414)
    })

    it('should not forward message, unknown verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(333), 1500, src, dst, msgBody)

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(cfg.keys[0].publicKey), sign(desc.hash(), cfg.keys[0].secretKey)],
                        [new BN(cfg.keys[1].publicKey), sign(desc.hash(), cfg.keys[1].secretKey)]
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(404)
    })

    it('should add new verifier', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let user = randomAddress();

        let kp3 = await randomKeyPair()

        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: user,
            value: toNano(10005),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.updateVerifier({
                        id: new BN(123),
                        quorum: 7,
                        endpoints: new Map<BN, number>([
                            [new BN(kp3.publicKey), 321]
                        ]),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(0)
        expect(res.type).toEqual("success")

        let data = await contract.getVerifier(new BN(123));
        let sets = (data.settings as Cell).beginParse()
        let quorum = sets.readUint(8);
        let settings = sets.readDict<number>(256, function (slice) {
            return slice.readUint(32).toNumber();
        });
        let ip = settings.get(new BN(kp3.publicKey).toString());

        console.log(res.gas_consumed)
        expect(data.admin?.toFriendly()).toEqual(user.toFriendly())
        expect(ip).toEqual(321)
        expect(quorum.toNumber()).toEqual(7)

        let reserve = res.actionList[0] as ReserveCurrencyAction
        expect(reserve.currency.coins.toNumber()).toEqual(toNano(1 + 10000).toNumber())

        let excess = res.actionList[1] as SendMsgAction
        expect(excess.message.info.dest?.toFriendly()).toEqual(user.toFriendly())
        expect(excess.mode).toEqual(128 + 2)

        let body = excess.message.body.beginParse();
        expect(body.readUint(32).toNumber()).toEqual(0)
        expect(body.readBuffer(body.remaining/8).toString()).toEqual("You were successfully registered as a verifier")
    })

    it('full scenario', async () => {
        let cfg = await genDefaultConfig()
        let contract = await RegistryLocal.createFromConfig(cfg.data)
        let user = randomAddress();

        let kp3 = await randomKeyPair()

        // add
        let res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: user,
            value: toNano(10005),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.updateVerifier({
                        id: new BN(123),
                        quorum: 7,
                        endpoints: new Map<BN, number>([
                            [new BN(kp3.publicKey), 321]
                        ]),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(0)
        expect(res.type).toEqual("success")

        let data = await contract.getVerifier(new BN(123));
        let sets = (data.settings as Cell).beginParse()
        let quorum = sets.readUint(8);
        let settings = sets.readDict<number>(256, function (slice) {
            return slice.readUint(32).toNumber();
        });
        let ip = settings.get(new BN(kp3.publicKey).toString());

        expect(ip).toEqual(321)
        expect(quorum.toNumber()).toEqual(7)

        // update
        res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: user,
            value: toNano(5),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.updateVerifier({
                        id: new BN(123),
                        quorum: 1,
                        endpoints: new Map<BN, number>([
                            [new BN(kp3.publicKey), 3212]
                        ]),
                    }))
            }),
        }))

        data = await contract.getVerifier(new BN(123));
        sets = (data.settings as Cell).beginParse()
        quorum = sets.readUint(8);
        settings = sets.readDict<number>(256, function (slice) {
            return slice.readUint(32).toNumber();
        });
        ip = settings.get(new BN(kp3.publicKey).toString());

        expect(ip).toEqual(3212)
        expect(quorum.toNumber()).toEqual(1)

        // forward
        let src = randomAddress();
        let dst = randomAddress();
        let msgBody = beginCell().storeUint(777, 32).endCell();

        let desc = buildMsgDescription(new BN(123), 1500, src, dst, msgBody)

        res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(kp3.publicKey), sign(desc.hash(), kp3.secretKey)],
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(0)

        let excess = res.actionList[0] as SendMsgAction
        expect(excess.message.info.dest?.toFriendly()).toEqual(dst.toFriendly())
        expect(excess.mode).toEqual(64)

        // remove
        res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: user,
            value: toNano(1),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(
                    Queries.removeVerifier({
                        id: new BN(123),
                    }))
            }),
        }))

        expect(res.exit_code).toEqual(0)

        // should not forward

        res = await contract.contract.sendInternalMessage(new InternalMessage({
            to: contract.address,
            from: src,
            value: toNano(3),
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(Queries.forwardMessage({
                    desc,
                    signatures: new Map<BN, Buffer>([
                        [new BN(kp3.publicKey), sign(desc.hash(), kp3.secretKey)],
                    ]),
                }))
            }),
        }))

        expect(res.exit_code).toEqual(404)
    })
})