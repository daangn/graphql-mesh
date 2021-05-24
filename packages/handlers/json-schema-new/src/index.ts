import {
  EnumTypeComposerValueConfigDefinition,
  GraphQLJSON,
  isSomeInputTypeComposer,
  SchemaComposer,
} from 'graphql-compose';
import { JSONSchema } from '@json-schema-tools/meta-schema';
import traverse from '@json-schema-tools/traverse';
import { GraphQLBoolean, GraphQLFloat, GraphQLInt, GraphQLString } from 'graphql';
import {
  GraphQLBigInt,
  GraphQLDate,
  GraphQLDateTime,
  GraphQLEmailAddress,
  GraphQLIPv4,
  GraphQLIPv6,
  GraphQLTime,
  GraphQLURL,
  GraphQLVoid,
  RegularExpression,
} from 'graphql-scalars';

export function visitJSONSchema(schema: JSONSchema, schemaComposer: SchemaComposer, prefix: string) {
  const refTypeComposerMap = new Map<any, any>();

  function ensureTypeComposer(maybeTypeComposer: any) {
    return refTypeComposerMap.get(maybeTypeComposer) || maybeTypeComposer;
  }

  return traverse(schema, (subSchema, _, path) => {
    const getTypeComposer = () => {
      if (typeof subSchema === 'boolean') {
        return subSchema ? schemaComposer.getAnyTC(GraphQLJSON) : undefined;
      }
      subSchema.title = subSchema.title || path.split('/').join('_');
      subSchema.title = prefix + subSchema.title;
      if (subSchema.pattern) {
        return schemaComposer.createScalarTC(
          new RegularExpression(subSchema.title, new RegExp(subSchema.pattern), {
            description: subSchema.description,
          })
        );
      }
      if (subSchema.const) {
        return schemaComposer.createScalarTC(
          new RegularExpression(subSchema.title, new RegExp(subSchema.const), {
            description: subSchema.description,
          })
        );
      }
      if (subSchema.enum) {
        const values: Record<string, EnumTypeComposerValueConfigDefinition> = {};
        for (const value of subSchema.enum) {
          values[value] = subSchema.enum;
        }
        return schemaComposer.createEnumTC({
          name: subSchema.title,
          values,
        });
      }
      if (subSchema.allOf) {
        const typeComposers = subSchema.allOf.map(ensureTypeComposer);
        // Scalars cannot be in union type
        if (typeComposers.some(typeComposer => isSomeInputTypeComposer(typeComposer))) {
          return schemaComposer.getAnyTC(GraphQLJSON);
        }
        return schemaComposer.createUnionTC({
          name: subSchema.title,
          description: subSchema.description,
          types: typeComposers,
        });
      }
      if (subSchema.anyOf) {
        const typeComposers = subSchema.anyOf.map(ensureTypeComposer);
        // Scalars cannot be in union type
        if (typeComposers.some(typeComposer => isSomeInputTypeComposer(typeComposer))) {
          return schemaComposer.getAnyTC(GraphQLJSON);
        }
        return schemaComposer.createUnionTC({
          name: subSchema.title,
          description: subSchema.description,
          types: typeComposers,
        });
      }
      if (subSchema.oneOf) {
        const typeComposers = subSchema.oneOf.map(ensureTypeComposer);
        // Scalars cannot be in union type
        if (typeComposers.some(typeComposer => isSomeInputTypeComposer(typeComposer))) {
          return schemaComposer.getAnyTC(GraphQLJSON);
        }
        return schemaComposer.createUnionTC({
          name: subSchema.title,
          description: subSchema.description,
          types: typeComposers,
        });
      }
      switch (subSchema.type) {
        case 'boolean':
          return schemaComposer.getAnyTC(GraphQLBoolean);
        case 'null':
          return schemaComposer.getAnyTC(GraphQLVoid);
        case 'integer':
          if (subSchema.format === 'int64') {
            return schemaComposer.getAnyTC(GraphQLBigInt);
          }
          return schemaComposer.getAnyTC(GraphQLInt);
        case 'number':
          return schemaComposer.getAnyTC(GraphQLFloat);
        case 'string':
          if (subSchema.minLength || subSchema.maxLength) {
            const coerceString = (v: any) => {
              if (v != null) {
                const vStr = v.toString();
                if (typeof subSchema.minLength !== 'undefined' && vStr.length > subSchema.minLength) {
                  throw new Error(`${subSchema.title} cannot be less than ${subSchema.minLength}`);
                }
                if (typeof subSchema.maxLength !== 'undefined' && vStr.length > subSchema.maxLength) {
                  throw new Error(`${subSchema.title} cannot be more than ${subSchema.maxLength}`);
                }
                return vStr;
              }
            };
            return schemaComposer.createScalarTC({
              name: subSchema.title,
              description: subSchema.description,
              serialize: coerceString,
              parseLiteral: coerceString,
              parseValue: ast => ast?.value && coerceString(ast.value),
            });
          }
          switch (subSchema.format) {
            case 'date-time':
              return schemaComposer.getAnyTC(GraphQLDateTime);
            case 'time':
              return schemaComposer.getAnyTC(GraphQLTime);
            case 'date':
              return schemaComposer.getAnyTC(GraphQLDate);
            case 'email':
            case 'idn-email':
              return schemaComposer.getAnyTC(GraphQLEmailAddress);
            case 'hostname':
              return schemaComposer.getAnyTC(GraphQLString);
            case 'ipv4':
              return schemaComposer.getAnyTC(GraphQLIPv4);
            case 'ipv6':
              return schemaComposer.getAnyTC(GraphQLIPv6);
            case 'uri':
            case 'uri-reference':
            case 'iri':
            case 'iri-reference':
            case 'uri-template':
              return schemaComposer.getAnyTC(GraphQLURL);
            case 'json-pointer':
              return schemaComposer.getAnyTC(GraphQLString);
            case 'relative-json-pointer':
              return schemaComposer.getAnyTC(GraphQLString);
            case 'regex':
              return schemaComposer.getAnyTC(GraphQLString);
            default:
              return schemaComposer.getAnyTC(GraphQLString);
          }
        case 'array':
          if (typeof subSchema.items === 'object' && !Array.isArray(subSchema.items)) {
            const typeComposer = ensureTypeComposer(subSchema.items);
            return typeComposer.getTypePlural();
          }
          if (subSchema.contains) {
            // Scalars cannot be in union type
            return schemaComposer.getAnyTC(GraphQLJSON).getTypePlural();
          }
          if (typeof subSchema.items === 'object' && Array.isArray(subSchema.items)) {
            const existingItems = [...(subSchema.items as any)];
            if (subSchema.additionalItems) {
              existingItems.push(subSchema.additionalItems);
            }
            const typeComposers = existingItems.map(ensureTypeComposer);
            if (typeComposers.some(existingItem => isSomeInputTypeComposer(existingItem))) {
              return schemaComposer.getAnyTC(GraphQLJSON);
            }
            const unionComposer = schemaComposer.createUnionTC({
              name: subSchema.title,
              description: subSchema.description,
              types: typeComposers,
            });
            return unionComposer.getTypePlural();
          }
        // eslint-disable-next-line no-fallthrough
        case 'object':
          // eslint-disable-next-line no-case-declarations
          const fieldMap: any = {};
          for (const propertyName in subSchema.properties) {
            const typeComposer = ensureTypeComposer(subSchema.properties[propertyName]);
            fieldMap[propertyName] = {
              type: subSchema.required?.includes(propertyName) ? typeComposer.getTypeNonNull() : typeComposer,
            };
          }
          if (subSchema.additionalProperties) {
            fieldMap.additionalProperties = {
              type: ensureTypeComposer(subSchema.additionalProperties),
              resolve: (root: any) => root,
            };
          }
          return schemaComposer.createObjectTC({
            name: subSchema.title,
            description: subSchema.description,
            fields: fieldMap,
          });
      }
    };
    const result = getTypeComposer();
    refTypeComposerMap.set(subSchema, result);
    return result;
  });
}
