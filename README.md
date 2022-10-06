# TON Registry Contract

[Tests](/packages/contracts/registry-contract/Registry.spec.ts)

[Contract source code](/packages/contracts/sources/registry.fc)

TLB:
```tl-b
message_description#_ verifier_id:uint256 valid_until:uint32 source_addr:MsgAddress target_addr:MsgAddress msg:^Cell = MessageDescription;
message_signatures#_ {n:#} signature:(bits 512) pub_key:uint256 next:^(MessageSignatureData n) = MessageSignatureData (n + 1);
message_signatures_last#_ signature:(bits 512) pub_key:uint256 = MessageSignatureData 1;
forward_message#75217758 {n:#} query_id:uint64 msg:^MessageDescription signatures:^(MessageSignatureData n) = InternalMsgBody;

verifier_settings#_ multi_sig_threshold:uint8 pub_key_endpoints:(HashMapE 256 uint32) = VerifierSettings;
update_verifier#6002d61a query_id:uint64 verifier_id:uint256 settings:VerifierSettings = InternalMsgBody;

remove_verifier#19fa5637 query_id:uint64 id:uint256 = InternalMsgBody;

verifier#_ admin:MsgAddress settings:VerifierSettings = Verifier;
storage#_ verifiers:(HashMapE 256 Verifier) = Storage;
```
