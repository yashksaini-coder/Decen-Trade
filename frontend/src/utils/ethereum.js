// src/utils/ethereum.js
import { ethers } from 'ethers'
import DecentradeNFTAbi from '../../../smart-contracts/artifacts/contracts/Marketplace.sol/DecentradeNFT.json'
import DecentradeMarketplaceAbi from '../../../smart-contracts/artifacts/contracts/Marketplace.sol/DecentradeMarketplace.json'
import {
    testIpfs,
    uploadMetadataToIPFS,
    uploadToIPFS,
} from '../services/pinataService'

const nftAddress = 'YOUR_DEPLOYED_NFT_CONTRACT_ADDRESS'
const marketplaceAddress = 'YOUR_DEPLOYED_MARKETPLACE_CONTRACT_ADDRESS'

export const connectWallet = async () => {
    if (window.ethereum) {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' })
            console.log('connection req sent')
            const provider = new ethers.BrowserProvider(window.ethereum)
            console.log(provider, 'provider')
            const signer = await provider.getSigner()
            console.log('Wallet connected:', signer)
            return signer
        } catch (error) {
            console.error('User denied account access', error)
        }
    } else {
        console.log('Ethereum object not found, install MetaMask.')
    }
}

export const getNFTContract = (signer) => {
    return new ethers.Contract(nftAddress, DecentradeNFTAbi.abi, signer)
}

export const getMarketplaceContract = (signer) => {
    return new ethers.Contract(
        marketplaceAddress,
        DecentradeMarketplaceAbi.abi,
        signer
    )
}

export const createNFT = async (signer, name, description, price, file) => {
    testIpfs()
    const fileUrl = await uploadToIPFS(file)
    const nftContract = getNFTContract(signer)
    const marketplaceContract = getMarketplaceContract(signer)

    // Create NFT metadata
    const data = JSON.stringify({
        name,
        description,
        image: fileUrl,
    })
    const url = await uploadMetadataToIPFS(data)
    // const added = await ipfsClient.add(data)
    // const url = `https://ipfs.infura.io/ipfs/${added.path}`

    // Mint NFT
    let transaction = await nftContract.mintNFT(await signer.getAddress(), url)
    const tx = await transaction.wait()

    const event = tx.events[0]
    const value = event.args[2]
    const tokenId = value.toNumber()

    // List NFT
    const listingPrice = await marketplaceContract.getListingFee()
    transaction = await marketplaceContract.createMarketItem(
        nftAddress,
        tokenId,
        ethers.utils.parseUnits(price, 'ether'),
        { value: listingPrice }
    )
    await transaction.wait()

    return tokenId
}

export const fetchMarketItems = async (signer) => {
    const marketplaceContract = getMarketplaceContract(signer)
    const data = await marketplaceContract.fetchMarketItems()
    return data
}

export const fetchMyNFTs = async (signer) => {
    const marketplaceContract = getMarketplaceContract(signer)
    const data = await marketplaceContract.fetchMyNFTs()
    return data
}

export const buyNFT = async (signer, nftContract, itemId, price) => {
    const marketplaceContract = getMarketplaceContract(signer)
    const transaction = await marketplaceContract.createMarketSale(
        nftContract,
        itemId,
        { value: price }
    )
    await transaction.wait()
    return transaction
}

export const listNFT = async (signer, tokenId, price) => {
    try {
        const marketplaceContract = getMarketplaceContract(signer)
        const listingPrice = await marketplaceContract.getListingFee()
        const transaction = await marketplaceContract.createMarketItem(
            nftAddress,
            tokenId,
            ethers.utils.parseUnits(price, 'ether'),
            { value: listingPrice }
        )
        await transaction.wait()
        console.log(`NFT with Token ID ${tokenId} listed successfully.`)
    } catch (error) {
        console.error('Error listing NFT:', error)
    }
}

export const mintNFT = async (signer, name, description, file) => {
    try {
        // Upload image to IPFS
        const fileUrl = await uploadToIPFS(file)

        // Create metadata
        const metadata = JSON.stringify({
            name,
            description,
            image: fileUrl,
        })

        // Upload metadata to IPFS
        const metadataUrl = await uploadMetadataToIPFS(metadata)

        // Mint NFT using the metadata URL
        const nftContract = getNFTContract(signer)
        const transaction = await nftContract.mintNFT(
            await signer.getAddress(),
            metadataUrl
        )
        const tx = await transaction.wait()

        // Get the minted token ID
        const event = tx.events[0]
        const tokenId = event.args[2].toNumber()

        console.log(`NFT minted with Token ID: ${tokenId}`)
        return tokenId
    } catch (error) {
        console.error('Error minting NFT:', error)
    }
}
