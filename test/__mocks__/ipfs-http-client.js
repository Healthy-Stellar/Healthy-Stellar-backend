// Manual mock for ipfs-http-client (ESM-only package)
module.exports = {
    create: jest.fn(() => ({
        add: jest.fn(async () => ({
            path: 'QmMockIPFSHash123456789',
            cid: {
                toString: () => 'QmMockIPFSHash123456789',
            },
        })),
        cat: jest.fn(async function* () {
            yield Buffer.from('mock file content');
        }),
        pin: {
            add: jest.fn(),
            rm: jest.fn(),
        },
    })),
};
