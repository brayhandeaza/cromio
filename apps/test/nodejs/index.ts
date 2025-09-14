import { ECC, HASH } from "cryptografia";
import data from "./data.json"

(async () => {
    const { publicKey, privateKey } = await ECC.generateKeysAsync();
    const message = JSON.stringify(Array(1).fill(data[0]));
    const encrypted = await ECC.encryptAsync(message, publicKey);
    const hash = HASH.sha256(encrypted);

    const signature = await ECC.signAsync(hash, privateKey);
    const isValid = await ECC.verifyAsync(hash, signature, publicKey);

    console.log({
        publicKey,
        privateKey,
        isValid
    });

})();