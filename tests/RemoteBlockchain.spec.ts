import { Blockchain, RemoteBlockchainStorage, SandboxContract, TreasuryContract, internal, printTransactionFees, wrapTonClient4ForRemote } from '@ton/sandbox';
import '@ton/test-utils';
import { TonClient4 } from '@ton/ton';
import { getHttpV4Endpoint } from '@orbs-network/ton-access'
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { FNZ_ADMIN, FNZ_MINTER, JUSDT_MINTER, STONFI_ROUTER, STONFI_ROUTER_JUSDT_WALLET } from './utils/constants';
import { beginCell, toNano } from '@ton/core'

jest.setTimeout(20000)

describe('Remote Blockchain Storage Example', () => {

    let blockchain: Blockchain;

    beforeAll(async () => {
        blockchain = await Blockchain.create(
            {
                storage: new RemoteBlockchainStorage(
                    wrapTonClient4ForRemote(
                        new TonClient4(
                            {
                                endpoint: await getHttpV4Endpoint(
                                    { network: 'mainnet' }
                                )
                            }
                        )
                    )
                )
            }
        );
    });

    let user: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        user = await blockchain.treasury('user');
    });

    it('should swap tokens', async () => {

        const fnzMinter = blockchain.openContract(JettonMinter.createFromAddress(FNZ_MINTER));

        await blockchain.sendMessage(
            internal({
                from: FNZ_ADMIN,
                to: FNZ_MINTER,
                value: toNano('0.5'),
                body: beginCell()
                    .storeUint(21, 32)
                    .storeUint(0, 64)
                    .storeAddress(user.address)
                    .storeCoins(toNano('0.05'))
                    .storeRef(
                        beginCell()
                            .storeUint(0x178d4519, 32)
                            .storeUint(0, 64)
                            .storeCoins(toNano('1000'))
                            .storeAddress(FNZ_MINTER)
                            .storeAddress(FNZ_ADMIN)
                            .storeCoins(0)
                            .storeUint(0, 1)
                        .endCell()
                    )
                .endCell(),

            })
        );

        const userFnzWalletAddress = await fnzMinter.getWalletAddress(user.address);
        expect((await blockchain.getContract(userFnzWalletAddress)).accountState?.type === 'active')

        const userFnzWallet = blockchain.openContract(JettonWallet.createFromAddress(userFnzWalletAddress));

        const transferJettonResult = await userFnzWallet.sendTransfer(user.getSender(), {
            toAddress: STONFI_ROUTER,
            fwdAmount: toNano('0.25'),
            jettonAmount: toNano('100'),
            fwdPayload: beginCell()
                .storeUint(0x25938561, 32)
                .storeAddress(STONFI_ROUTER_JUSDT_WALLET)
                .storeCoins(1n)
                .storeAddress(user.address)
                .storeUint(0, 1)
            .endCell()
        });

        printTransactionFees(transferJettonResult.transactions)

        const jusdtMinter = blockchain.openContract(JettonMinter.createFromAddress(JUSDT_MINTER));

        const userJusdtWalletAddress = await jusdtMinter.getWalletAddress(user.address);

        expect((await blockchain.getContract(userJusdtWalletAddress)).accountState?.type === 'active')

        console.log((await blockchain.getContract(userJusdtWalletAddress)).get('get_wallet_data').stackReader.readBigNumber())
    });
});
