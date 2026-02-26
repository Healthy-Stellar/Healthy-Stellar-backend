// Manual mock for bull (not directly installed)
module.exports = {
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn(),
        process: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
    })),
};
