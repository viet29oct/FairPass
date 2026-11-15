const { ethers } = require("ethers");
const config = require("./config");

const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
const contract = new ethers.Contract(config.contractAddress, config.abi, provider);

const ORGANIZER_ROLE = ethers.id("ORGANIZER_ROLE");
const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

module.exports = { ethers, provider, contract, ORGANIZER_ROLE, DEFAULT_ADMIN_ROLE };
