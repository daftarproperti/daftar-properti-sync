const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config;

function loadABI(version) {
    const abiPath = path.join(__dirname, 'abis', `v${version}.json`);
    if (!fs.existsSync(abiPath)) {
        throw new Error(`ABI for version ${version} not found`);
    }
    const abi = fs.readFileSync(abiPath, 'utf-8');
    return JSON.parse(abi);
}

function getContract(address, provider, version = 0) {
    const CONTRACT_ABI = loadABI(version);
    const contract = new ethers.Contract(address, CONTRACT_ABI, provider);
    return contract;
}

module.exports = {
    getContract
};