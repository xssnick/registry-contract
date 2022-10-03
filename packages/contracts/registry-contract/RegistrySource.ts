import {combineFunc} from "../../utils/combineFunc";

export const RegistrySource = combineFunc(__dirname, [
    '../sources/stdlib.fc',
    '../sources/registry.fc',
])