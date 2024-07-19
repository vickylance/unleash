import {
    FEATURE_ARCHIVED,
    FEATURE_CREATED,
    FEATURE_ENVIRONMENT_DISABLED,
    type IEvent,
} from '../types/events';
import type { Logger } from '../logger';

import DatadogAddon from './datadog';

import noLogger from '../../test/fixtures/no-logger';
import type { IAddonConfig, IFlagResolver } from '../types';
import type { IntegrationEventsService } from '../services';

let fetchRetryCalls: any[] = [];

const INTEGRATION_ID = 1337;
const ARGS: IAddonConfig = {
    getLogger: noLogger,
    unleashUrl: 'http://some-url.com',
    integrationEventsService: {} as IntegrationEventsService,
    flagResolver: {} as IFlagResolver,
};

jest.mock(
    './addon',
    () =>
        class Addon {
            logger: Logger;

            constructor(definition, { getLogger }) {
                this.logger = getLogger('addon/test');
                fetchRetryCalls = [];
            }

            async fetchRetry(url, options, retries, backoff) {
                fetchRetryCalls.push({
                    url,
                    options,
                    retries,
                    backoff,
                });
                return Promise.resolve({ status: 200 });
            }

            async registerEvent(_) {
                return Promise.resolve();
            }
        },
);

test('Should call datadog webhook', async () => {
    const addon = new DatadogAddon(ARGS);
    const event: IEvent = {
        id: 1,
        createdAt: new Date(),
        type: FEATURE_CREATED,
        createdBy: 'some@user.com',
        createdByUserId: -1337,
        featureName: 'some-toggle',
        data: {
            name: 'some-toggle',
            enabled: false,
            strategies: [{ name: 'default' }],
        },
    };

    const parameters = {
        url: 'http://api.datadoghq.com/api/v1/events',
        apiKey: 'fakeKey',
    };

    await addon.handleEvent(event, parameters, INTEGRATION_ID);
    expect(fetchRetryCalls.length).toBe(1);
    expect(fetchRetryCalls[0].url).toBe(parameters.url);
    expect(fetchRetryCalls[0].options.body).toMatchSnapshot();
});

test('Should call datadog webhook  for archived toggle', async () => {
    const addon = new DatadogAddon(ARGS);
    const event: IEvent = {
        id: 2,
        createdAt: new Date(),
        type: FEATURE_ARCHIVED,
        createdBy: 'some@user.com',
        createdByUserId: -1337,
        featureName: 'some-toggle',
        data: {
            name: 'some-toggle',
        },
    };

    const parameters = {
        url: 'http://api.datadoghq.com/api/v1/events',
        apiKey: 'fakeKey',
    };

    await addon.handleEvent(event, parameters, INTEGRATION_ID);
    expect(fetchRetryCalls.length).toBe(1);
    expect(fetchRetryCalls[0].url).toBe(parameters.url);
    expect(fetchRetryCalls[0].options.body).toMatchSnapshot();
});

test('Should call datadog webhook  for archived toggle with project info', async () => {
    const addon = new DatadogAddon(ARGS);
    const event: IEvent = {
        id: 2,
        createdAt: new Date(),
        type: FEATURE_ARCHIVED,
        createdBy: 'some@user.com',
        featureName: 'some-toggle',
        createdByUserId: -1337,
        project: 'some-project',
        data: {
            name: 'some-toggle',
        },
    };

    const parameters = {
        url: 'http://api.datadoghq.com/api/v1/events',
        apiKey: 'fakeKey',
    };

    await addon.handleEvent(event, parameters, INTEGRATION_ID);
    expect(fetchRetryCalls.length).toBe(1);
    expect(fetchRetryCalls[0].url).toBe(parameters.url);
    expect(fetchRetryCalls[0].options.body).toMatchSnapshot();
});

test('Should call datadog webhook for toggled environment', async () => {
    const addon = new DatadogAddon(ARGS);
    const event: IEvent = {
        id: 2,
        createdAt: new Date(),
        type: FEATURE_ENVIRONMENT_DISABLED,
        createdBy: 'some@user.com',
        createdByUserId: -1337,
        environment: 'development',
        project: 'default',
        featureName: 'some-toggle',
        data: {
            name: 'some-toggle',
        },
    };

    const parameters = {
        url: 'http://hooks.slack.com',
        apiKey: 'fakeKey',
    };

    await addon.handleEvent(event, parameters, INTEGRATION_ID);
    expect(fetchRetryCalls).toHaveLength(1);
    expect(fetchRetryCalls[0].url).toBe(parameters.url);
    expect(fetchRetryCalls[0].options.body).toMatch(/disabled/);
    expect(fetchRetryCalls[0].options.body).toMatchSnapshot();
});

test('Should include customHeaders in headers when calling service', async () => {
    const addon = new DatadogAddon(ARGS);
    const event: IEvent = {
        id: 2,
        createdAt: new Date(),
        type: FEATURE_ENVIRONMENT_DISABLED,
        createdBy: 'some@user.com',
        environment: 'development',
        createdByUserId: -1337,
        project: 'default',
        featureName: 'some-toggle',
        data: {
            name: 'some-toggle',
        },
    };

    const parameters = {
        url: 'http://hooks.slack.com',
        apiKey: 'fakeKey',
        customHeaders: `{ "MY_CUSTOM_HEADER": "MY_CUSTOM_VALUE" }`,
    };
    await addon.handleEvent(event, parameters, INTEGRATION_ID);
    expect(fetchRetryCalls).toHaveLength(1);
    expect(fetchRetryCalls[0].url).toBe(parameters.url);
    expect(fetchRetryCalls[0].options.body).toMatch(/disabled/);
    expect(fetchRetryCalls[0].options.body).toMatchSnapshot();
    expect(fetchRetryCalls[0].options.headers).toMatchSnapshot();
});

test('Should not include source_type_name when included in the config', async () => {
    const addon = new DatadogAddon(ARGS);
    const event: IEvent = {
        id: 2,
        createdAt: new Date(),
        type: FEATURE_ENVIRONMENT_DISABLED,
        createdBy: 'some@user.com',
        createdByUserId: -1337,
        environment: 'development',
        project: 'default',
        featureName: 'some-toggle',
        data: {
            name: 'some-toggle',
        },
    };

    const parameters = {
        url: 'http://hooks.slack.com',
        apiKey: 'fakeKey',
        sourceTypeName: 'my-custom-source-type',
    };

    await addon.handleEvent(event, parameters, INTEGRATION_ID);
    expect(fetchRetryCalls).toHaveLength(1);
    expect(fetchRetryCalls[0].url).toBe(parameters.url);
    expect(fetchRetryCalls[0].options.body).toMatch(
        /"source_type_name":"my-custom-source-type"/,
    );
    expect(fetchRetryCalls[0].options.body).toMatchSnapshot();
    expect(fetchRetryCalls[0].options.headers).toMatchSnapshot();
});

test('Should call datadog webhook with JSON when template set', async () => {
    const addon = new DatadogAddon(ARGS);
    const event: IEvent = {
        id: 1,
        createdAt: new Date(),
        type: FEATURE_CREATED,
        createdBy: 'some@user.com',
        createdByUserId: -1337,
        featureName: 'some-toggle',
        data: {
            name: 'some-toggle',
            enabled: false,
            strategies: [{ name: 'default' }],
        },
    };

    const parameters = {
        url: 'http://api.datadoghq.com/api/v1/events',
        apiKey: 'fakeKey',
        bodyTemplate:
            '{\n  "event": "{{event.type}}",\n  "createdBy": "{{event.createdBy}}"\n}',
    };

    await addon.handleEvent(event, parameters, INTEGRATION_ID);
    expect(fetchRetryCalls.length).toBe(1);
    expect(fetchRetryCalls[0].url).toBe(parameters.url);
    expect(fetchRetryCalls[0].options.body).toMatchSnapshot();
});
