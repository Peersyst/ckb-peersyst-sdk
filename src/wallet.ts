import { mnemonic, ExtendedPrivateKey, ExtendedPublicKey, AccountExtendedPublicKey, AddressType } from "@ckb-lumos/hd";

export class Wallet {
    public mnemo: string;
    public privateKey: ExtendedPrivateKey;
    public publicKey: ExtendedPublicKey;
    public accountPublicKey: AccountExtendedPublicKey;

    static create(): Wallet {
        const wallet = new Wallet();
        wallet.mnemo = mnemonic.generateMnemonic();
        const seed = mnemonic.mnemonicToSeedSync(wallet.mnemo);
        wallet.privateKey = ExtendedPrivateKey.fromSeed(seed);
        wallet.publicKey = wallet.privateKey.toExtendedPublicKey();
        wallet.accountPublicKey = wallet.privateKey.toAccountExtendedPublicKey();
        console.log(AccountExtendedPublicKey.ckbAccountPath);
        console.log(wallet.accountPublicKey.publicKeyInfo(AddressType.Change, 0));
        console.log(wallet.accountPublicKey.publicKeyInfo(AddressType.Receiving, 0));
        console.log(wallet);

        return wallet;
    }

    static importFromMnemonic(mnemo: string): Wallet {
        const wallet = new Wallet();
        wallet.mnemo = mnemo;
        const seed = mnemonic.mnemonicToSeedSync(wallet.mnemo);
        wallet.privateKey = ExtendedPrivateKey.fromSeed(seed);
        wallet.publicKey = wallet.privateKey.toExtendedPublicKey();
        wallet.accountPublicKey = wallet.privateKey.toAccountExtendedPublicKey();
        console.log(wallet);

        return wallet;
    }
}
