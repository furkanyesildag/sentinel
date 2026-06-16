import {
  Asset,
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { createRpcServer, type AppConfig } from '@defirisk/core';

export async function buildSelfPaymentTransaction(
  config: AppConfig,
  sourceAddress: string,
): Promise<string> {
  const server = createRpcServer(config);
  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: sourceAddress,
        asset: Asset.native(),
        amount: '0.0000001',
      }),
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export async function submitSignedTransaction(
  config: AppConfig,
  signedXdr: string,
): Promise<string> {
  const server = createRpcServer(config);
  const tx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const response = await server.sendTransaction(tx);

  if (response.status === 'ERROR') {
    throw new Error(response.errorResult?.toXDR('base64') ?? 'Transaction submission failed');
  }

  const hash = response.hash;

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const result = await server.getTransaction(hash);

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain');
    }
  }

  throw new Error('Transaction confirmation timed out');
}
