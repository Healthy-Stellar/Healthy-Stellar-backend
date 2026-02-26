// Manual mock for @nestjs-modules/mailer
module.exports = {
    MailerService: jest.fn().mockImplementation(() => ({
        sendMail: jest.fn().mockResolvedValue(undefined),
    })),
    MailerModule: {
        forRoot: jest.fn().mockReturnValue({ module: class { } }),
        forRootAsync: jest.fn().mockReturnValue({ module: class { } }),
    },
};
