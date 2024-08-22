const { ethers } = require('ethers');
require('dotenv').config;

const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "id",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "cityId",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "offChainLink",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "dataHash",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "ListingVerified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "id",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "cityId",
        "type": "uint64"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "offChainLink",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "dataHash",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "NewListing",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "_id",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "_cityId",
        "type": "uint64"
      },
      {
        "internalType": "string",
        "name": "_offChainLink",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_dataHash",
        "type": "string"
      }
    ],
    "name": "addListing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "_id",
        "type": "uint64"
      }
    ],
    "name": "getListing",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "name": "listings",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "id",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "cityId",
        "type": "uint64"
      },
      {
        "internalType": "string",
        "name": "offChainLink",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "dataHash",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "verified",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "_id",
        "type": "uint64"
      }
    ],
    "name": "verifyListing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

function getContract(address, provider) {
    const contract = new ethers.Contract(address, CONTRACT_ABI, provider);
    return contract;
}

module.exports = {
    getContract
};