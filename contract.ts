import { ethers, Contract as EthersContract } from 'ethers';
import fs from 'fs';
import path from 'path';

const ABSOLUTE_ABI_PATH = path.join(__dirname, '..', 'abis');

export function loadABI(name: string, version: number): any {
    console.log(ABSOLUTE_ABI_PATH);
    const abiPath = path.join(ABSOLUTE_ABI_PATH, `${name}v${version}.json`);
    if (!fs.existsSync(abiPath)) {
        throw new Error(`ABI ${name} for version ${version} not found`);
    }

    const abi = fs.readFileSync(abiPath, 'utf-8');
    return JSON.parse(abi);
}

export function getContract(name: string, address: string, provider: ethers.Provider, version: number = 0): EthersContract {
    const CONTRACT_ABI = loadABI(name, version);
    return new ethers.Contract(address, CONTRACT_ABI, provider);
}
