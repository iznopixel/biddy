import { z } from 'zod';

const customerSchema = z.object({ Id: z.string(), DisplayName: z.string(), FullyQualifiedName: z.string().optional() });
const serviceSchema = z.object({ Id: z.string(), Name: z.string(), FullyQualifiedName: z.string().optional(), Description: z.string().optional() });

export type EstimateLine = { description: string; cents: number; serviceId: string };

export class QuickBooksError extends Error {
  constructor(readonly status: number) {
    super('QuickBooks request failed');
  }
}

export function quickBooks() {
  const realm = process.env.QBO_REALM_ID;
  const token = process.env.QBO_ACCESS_TOKEN;
  if (!realm || !/^\d+$/.test(realm) || !token) throw new QuickBooksError(503);

  const base = 'https://sandbox-quickbooks.api.intuit.com/v3/company/' + realm;
  async function request(path: string, body?: object): Promise<unknown> {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new QuickBooksError(response.status);
    return response.json();
  }

  async function query<T>(entity: 'Customer' | 'Item', schema: z.ZodType<T>, filter: string) {
    const results: T[] = [];
    const pageSize = 1000;
    for (let position = 1; ; position += pageSize) {
      const statement = 'SELECT * FROM ' + entity + ' WHERE Active = true' + filter +
        ' ORDERBY Id STARTPOSITION ' + position + ' MAXRESULTS ' + pageSize;
      const response = z.object({ QueryResponse: z.record(z.string(), z.unknown()) })
        .parse(await request('/query?' + new URLSearchParams({ query: statement })));
      const page = z.array(schema).parse(response.QueryResponse[entity] ?? []);
      results.push(...page);
      if (page.length < pageSize) return results;
    }
  }

  return {
    customers: () => query('Customer', customerSchema, ''),
    services: () => query('Item', serviceSchema, " AND Type = 'Service'"),
    async createEstimate(customerId: string, lines: EstimateLine[]) {
      const response = await request('/estimate', {
        CustomerRef: { value: customerId },
        EmailStatus: 'NotSet',
        Line: lines.map(({ description, cents, serviceId }) => ({
          Amount: cents / 100,
          Description: description,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: serviceId },
            Qty: 1,
            UnitPrice: cents / 100,
          },
        })),
      });
      return z.object({ Estimate: z.object({ Id: z.string(), DocNumber: z.string().optional() }) })
        .parse(response).Estimate;
    },
  };
}
