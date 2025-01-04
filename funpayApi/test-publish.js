import { FunPayApi } from './funpayApi.js';

async function publishTestLot() {
    const funpayApi = new FunPayApi();
    
    const testData = {
        node_id: "2142", // AFK Arena - Алмазы
        title: "Под заказ",
        price: "111"
    };

    try {
        const response = await funpayApi.createLot(testData);
        console.log('Publication response:', response);
    } catch (error) {
        console.error('Publication error:', error);
    }
}

publishTestLot();