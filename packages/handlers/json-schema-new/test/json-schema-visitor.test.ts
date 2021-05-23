import { ObjectTypeComposer, SchemaComposer } from 'graphql-compose';
import { visitJSONSchema } from '../src';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import titleizer from '@json-schema-tools/titleizer';

describe('visitor', () => {
  it('should do something', async () => {
    const schemaComposer = new SchemaComposer();
    const someSchema: any = {
      definitions: {
        app: {
          definitions: {
            domains: {
              items: {
                $ref: '#/definitions/domain',
              },
              type: 'array',
            },
            name: {
              pattern: '^[a-z][a-z0-9-]{2,30}$',
              type: 'string',
            },
          },
          properties: {
            domains: {
              $ref: '#/definitions/app/definitions/domains',
            },
            name: {
              $ref: '#/definitions/app/definitions/name',
            },
          },
          required: ['name'],
          type: 'object',
        },
        domain: {
          definitions: {
            name: {
              format: 'hostname',
              type: 'string',
            },
          },
          properties: {
            name: {
              $ref: '#/definitions/domain/definitions/name',
            },
          },
          required: ['name'],
          type: 'object',
        },
      },
      properties: {
        app: {
          $ref: '#/definitions/app',
        },
        domain: {
          $ref: '#/definitions/domain',
        },
      },
      type: 'object',
    };
    const bundled = await $RefParser.bundle(someSchema);
    const dereferenced = await $RefParser.dereference(bundled);
    expect(dereferenced).toMatchSnapshot();
    const typeComposer: ObjectTypeComposer<any> = visitJSONSchema(
      dereferenced as any,
      schemaComposer,
      'DomainAPP'
    ) as any;
    schemaComposer.Query.addFields({
      test: {
        type: typeComposer,
      },
    });
    expect(schemaComposer.toSDL()).toMatchSnapshot();
  });
});
