# 固定 BGE 量化模型许可询证记录

日期：2026-10-13。**用户已明确授权发送，评论已创建并逐字读回；尚无上游授权答复。** 实际[评论6147791372](https://github.com/huggingface/transformers.js/issues/1487#issuecomment-6147791372)，账号`guxingzhou16-pixel`，创建时间`2026-10-13T14:24:57Z`，正文SHA-256 `41fc2e6438184bd672383840eceb575235c54f3043ccfcf554f27367c62b6b71`。目的为补齐当前五个固定文件的许可与通知依据，不变更模型、摘要或向量缓存。

维护者已在[官方许可讨论 #1487](https://github.com/huggingface/transformers.js/issues/1487)邀请报告缺许可信息的其他模型；该讨论对Whisper/UAE/BERT的答复并非本BGE版本的授权。[BGE现有讨论](https://huggingface.co/Xenova/bge-small-zh-v1.5/discussions/1)是量化格式更新，没有相应许可答复。用户审阅下方全文后，明确允许发送这一条公开评论；此许可不扩展到其他上游消息。

GitHub连接器首次创建返回403“Resource not accessible by integration”，未成功。随后核对本机已有Git认证的实际账号、目标issue身份/未锁定及无重复全文，只POST一次；成功后按comment ID读回核对账号、目标及全文。不保存凭据，未修改/重开上游issue。本机回执为`artifacts/signed-distribution-7ff696bd-f0c1-450f-a1d6-ad8db0bb9681/bge-inquiry-send-result.json`。

## 已发送全文

Hello @xenova and model maintainers,

Following your invitation to report converted models with missing license information, could you clarify the applicable license and required notices for `Xenova/bge-small-zh-v1.5` at revision `75c43b069aac4d136ba6bc1122f995fedcfd2781`?

Our MIT-licensed Windows study application lets users explicitly download these five files from that fixed upstream revision for local CPU embeddings. The model weights are not bundled in the application installer, and we do not relicense third-party files as application-owned code.

| File                      | Bytes    | SHA-256                                                          |
| ------------------------- | -------- | ---------------------------------------------------------------- |
| config.json               | 716      | d4193ead3a810fd694fa8a31d7fc72fbaebc0668b603e398734bf2f6538ff42f |
| tokenizer.json            | 439125   | 48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26 |
| tokenizer_config.json     | 367      | e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a |
| special_tokens_map.json   | 125      | b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3 |
| onnx/model_quantized.onnx | 24010842 | 15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc |

The [fixed converted model card](https://huggingface.co/Xenova/bge-small-zh-v1.5/blob/75c43b069aac4d136ba6bc1122f995fedcfd2781/README.md) identifies `BAAI/bge-small-zh-v1.5` as the base model, whose model card declares MIT. We have not found an explicit license declaration for the five converted files above.

1. Does MIT cover these exact converted/quantized weights and accompanying configuration/tokenizer files, including personal or commercial application use and unchanged redistribution?
2. Which exact copyright/license notices should accompany them? Please identify any separate tokenizer/vocabulary or conversion notices and link their authoritative text.
3. Could you add the license metadata and notice to the converted model repository, clarifying whether it also covers the pinned revision above?

If a different upstream notice or permission is needed, please point us to the appropriate source. We want to preserve the applicable terms accurately. Thank you.

## 收到答复后

保存真实评论URL/时间/作者及所覆盖的版本/文件；取得指定原始通知并核对摘要，按现有清单入包。只有答复与必要通知完整覆盖固定文件后，才关闭对应分发项；不能借其他模型的MIT答复、issue关闭状态或本项目MIT替代。
