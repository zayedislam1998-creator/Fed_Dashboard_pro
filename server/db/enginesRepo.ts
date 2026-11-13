import { prisma } from './prisma';

export const ENGINE_COLLECTIONS = [
  'sheets',
  'calendarEvents',
  'invoices',
  'expenses',
  'crmLeads',
  'supportTickets',
  'hrRecords',
  'chatChannels',
  'chatMessages',
  'wikiArticles',
  'automationRules',
] as const;

export type EngineCollectionKey = (typeof ENGINE_COLLECTIONS)[number];

export function isEngineCollection(val: string): val is EngineCollectionKey {
  return (ENGINE_COLLECTIONS as readonly string[]).includes(val);
}

function nowDateLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function spreadExtra(row: any): Record<string, any> {
  return row?.extraFields && typeof row.extraFields === 'object' ? row.extraFields : {};
}

export async function listEngineRecords(col: EngineCollectionKey): Promise<any[]> {
  switch (col) {
    case 'sheets': {
      const rows = await prisma.workspaceSheet.findMany({ orderBy: { timestampMs: 'desc' } });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        title: r.title,
        category: r.category,
        columns: Array.isArray(r.columnsJson) ? r.columnsJson : [],
        rows: Array.isArray(r.rowsJson) ? r.rowsJson : [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'calendarEvents': {
      const rows = await prisma.workspaceCalendarEvent.findMany({
        orderBy: { timestampMs: 'desc' },
      });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        title: r.title,
        description: r.description || '',
        eventType: r.eventType,
        date: r.date,
        startTime: r.startTime || '',
        endTime: r.endTime || '',
        location: r.location || '',
        color: r.color,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'invoices': {
      const rows = await prisma.workspaceInvoice.findMany({ orderBy: { timestampMs: 'desc' } });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        docType: r.docType,
        clientName: r.clientName,
        clientEmail: r.clientEmail,
        projectTitle: r.projectTitle || '',
        issueDate: r.issueDate,
        dueDate: r.dueDate,
        currency: r.currency,
        items: Array.isArray(r.itemsJson) ? r.itemsJson : [],
        taxPercent: r.taxPercent,
        discountAmt: r.discountAmt,
        totalAmount: r.totalAmount,
        status: r.status,
        notes: r.notes || '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'expenses': {
      const rows = await prisma.workspaceExpense.findMany({ orderBy: { timestampMs: 'desc' } });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        title: r.title,
        category: r.category,
        amount: r.amount,
        currency: r.currency,
        date: r.date,
        vendor: r.vendor || '',
        projectTitle: r.projectTitle || '',
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'crmLeads': {
      const rows = await prisma.workspaceCrmLead.findMany({ orderBy: { timestampMs: 'desc' } });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        name: r.name,
        company: r.company,
        email: r.email,
        phone: r.phone || '',
        stage: r.stage,
        dealValue: r.dealValue,
        assignedTo: r.assignedTo || '',
        notes: r.notes || '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'supportTickets': {
      const rows = await prisma.workspaceSupportTicket.findMany({
        orderBy: { timestampMs: 'desc' },
      });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        ticketNumber: r.ticketNumber,
        subject: r.subject,
        customerName: r.customerName,
        customerEmail: r.customerEmail,
        priority: r.priority,
        status: r.status,
        assignedTo: r.assignedTo || '',
        description: r.description,
        resolution: r.resolution || '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'hrRecords': {
      const rows = await prisma.workspaceHrRecord.findMany({ orderBy: { timestampMs: 'desc' } });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        recordType: r.recordType,
        memberName: r.memberName,
        memberEmail: r.memberEmail,
        dateOrMonth: r.dateOrMonth,
        status: r.status,
        details: r.detailsJson && typeof r.detailsJson === 'object' ? r.detailsJson : {},
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'chatChannels': {
      const rows = await prisma.workspaceChatChannel.findMany({
        orderBy: { timestampMs: 'desc' },
      });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        name: r.name,
        description: r.description || '',
        channelType: r.channelType,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'chatMessages': {
      const rows = await prisma.workspaceChatMessage.findMany({
        orderBy: { timestampMs: 'desc' },
      });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        channelId: r.channelId,
        senderName: r.senderName,
        senderEmail: r.senderEmail,
        text: r.text,
        isPinned: r.isPinned,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'wikiArticles': {
      const rows = await prisma.workspaceWikiArticle.findMany({
        orderBy: { timestampMs: 'desc' },
      });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        title: r.title,
        category: r.category,
        summary: r.summary || '',
        content: r.content,
        authorName: r.authorName,
        isPinned: r.isPinned,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        timestamp: Number(r.timestampMs),
      }));
    }
    case 'automationRules': {
      const rows = await prisma.workspaceAutomationRule.findMany({
        orderBy: { timestampMs: 'desc' },
      });
      return rows.map((r) => ({
        ...spreadExtra(r),
        id: r.id,
        name: r.name,
        triggerEvent: r.triggerEvent,
        actionType: r.actionType,
        targetValue: r.targetValue,
        isActive: r.isActive,
        runsCount: r.runsCount,
        lastRunAt: r.lastRunAt || undefined,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
        timestamp: Number(r.timestampMs),
      }));
    }
  }
}

export async function saveEngineRecordInDb(
  col: EngineCollectionKey,
  payload: Record<string, any>
): Promise<{ item: any; items: any[] }> {
  const nowStr = nowDateLabel();
  const id = payload.id
    ? String(payload.id)
    : `${col}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const ts = BigInt(Date.now());

  const extractExtra = (knownKeys: string[]) => {
    const known = new Set([...knownKeys, 'id', 'createdAt', 'updatedAt', 'timestamp']);
    const extra: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!known.has(k) && v !== undefined) {
        extra[k] = v;
      }
    }
    return extra;
  };

  switch (col) {
    case 'sheets': {
      const existing = await prisma.workspaceSheet.findUnique({ where: { id } });
      await prisma.workspaceSheet.upsert({
        where: { id },
        update: {
          ...(payload.title !== undefined ? { title: String(payload.title) } : {}),
          ...(payload.category !== undefined ? { category: String(payload.category) } : {}),
          ...(payload.columns !== undefined ? { columnsJson: payload.columns } : {}),
          ...(payload.rows !== undefined ? { rowsJson: payload.rows } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra(['title', 'category', 'columns', 'rows']),
        },
        create: {
          id,
          title: String(payload.title || 'Untitled Sheet'),
          category: String(payload.category || 'General'),
          columnsJson: Array.isArray(payload.columns) ? payload.columns : [],
          rowsJson: Array.isArray(payload.rows) ? payload.rows : [],
          createdAt: existing?.createdAt || String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra(['title', 'category', 'columns', 'rows']),
        },
      });
      break;
    }
    case 'calendarEvents': {
      await prisma.workspaceCalendarEvent.upsert({
        where: { id },
        update: {
          ...(payload.title !== undefined ? { title: String(payload.title) } : {}),
          ...(payload.description !== undefined ? { description: String(payload.description) } : {}),
          ...(payload.eventType !== undefined ? { eventType: String(payload.eventType) } : {}),
          ...(payload.date !== undefined ? { date: String(payload.date) } : {}),
          ...(payload.startTime !== undefined ? { startTime: String(payload.startTime) } : {}),
          ...(payload.endTime !== undefined ? { endTime: String(payload.endTime) } : {}),
          ...(payload.location !== undefined ? { location: String(payload.location) } : {}),
          ...(payload.color !== undefined ? { color: String(payload.color) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'title',
            'description',
            'eventType',
            'date',
            'startTime',
            'endTime',
            'location',
            'color',
          ]),
        },
        create: {
          id,
          title: String(payload.title || 'Untitled Event'),
          description: String(payload.description || ''),
          eventType: String(payload.eventType || 'EVENT'),
          date: String(payload.date || new Date().toISOString().slice(0, 10)),
          startTime: payload.startTime ? String(payload.startTime) : null,
          endTime: payload.endTime ? String(payload.endTime) : null,
          location: payload.location ? String(payload.location) : null,
          color: String(payload.color || '#0B57D0'),
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'title',
            'description',
            'eventType',
            'date',
            'startTime',
            'endTime',
            'location',
            'color',
          ]),
        },
      });
      break;
    }
    case 'invoices': {
      await prisma.workspaceInvoice.upsert({
        where: { id },
        update: {
          ...(payload.invoiceNumber !== undefined ? { invoiceNumber: String(payload.invoiceNumber) } : {}),
          ...(payload.docType !== undefined ? { docType: String(payload.docType) } : {}),
          ...(payload.clientName !== undefined ? { clientName: String(payload.clientName) } : {}),
          ...(payload.clientEmail !== undefined ? { clientEmail: String(payload.clientEmail) } : {}),
          ...(payload.projectTitle !== undefined ? { projectTitle: String(payload.projectTitle) } : {}),
          ...(payload.issueDate !== undefined ? { issueDate: String(payload.issueDate) } : {}),
          ...(payload.dueDate !== undefined ? { dueDate: String(payload.dueDate) } : {}),
          ...(payload.currency !== undefined ? { currency: String(payload.currency) } : {}),
          ...(payload.items !== undefined ? { itemsJson: payload.items } : {}),
          ...(payload.taxPercent !== undefined ? { taxPercent: Number(payload.taxPercent) || 0 } : {}),
          ...(payload.discountAmt !== undefined ? { discountAmt: Number(payload.discountAmt) || 0 } : {}),
          ...(payload.totalAmount !== undefined ? { totalAmount: Number(payload.totalAmount) || 0 } : {}),
          ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
          ...(payload.notes !== undefined ? { notes: String(payload.notes) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'invoiceNumber',
            'docType',
            'clientName',
            'clientEmail',
            'projectTitle',
            'issueDate',
            'dueDate',
            'currency',
            'items',
            'taxPercent',
            'discountAmt',
            'totalAmount',
            'status',
            'notes',
          ]),
        },
        create: {
          id,
          invoiceNumber: String(payload.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`),
          docType: String(payload.docType || 'INVOICE'),
          clientName: String(payload.clientName || ''),
          clientEmail: String(payload.clientEmail || ''),
          projectTitle: payload.projectTitle ? String(payload.projectTitle) : null,
          issueDate: String(payload.issueDate || nowStr),
          dueDate: String(payload.dueDate || nowStr),
          currency: String(payload.currency || 'USD'),
          itemsJson: Array.isArray(payload.items) ? payload.items : [],
          taxPercent: Number(payload.taxPercent) || 0,
          discountAmt: Number(payload.discountAmt) || 0,
          totalAmount: Number(payload.totalAmount) || 0,
          status: String(payload.status || 'Unpaid'),
          notes: payload.notes ? String(payload.notes) : null,
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'invoiceNumber',
            'docType',
            'clientName',
            'clientEmail',
            'projectTitle',
            'issueDate',
            'dueDate',
            'currency',
            'items',
            'taxPercent',
            'discountAmt',
            'totalAmount',
            'status',
            'notes',
          ]),
        },
      });
      break;
    }
    case 'expenses': {
      await prisma.workspaceExpense.upsert({
        where: { id },
        update: {
          ...(payload.title !== undefined ? { title: String(payload.title) } : {}),
          ...(payload.category !== undefined ? { category: String(payload.category) } : {}),
          ...(payload.amount !== undefined ? { amount: Number(payload.amount) || 0 } : {}),
          ...(payload.currency !== undefined ? { currency: String(payload.currency) } : {}),
          ...(payload.date !== undefined ? { date: String(payload.date) } : {}),
          ...(payload.vendor !== undefined ? { vendor: String(payload.vendor) } : {}),
          ...(payload.projectTitle !== undefined ? { projectTitle: String(payload.projectTitle) } : {}),
          ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'title',
            'category',
            'amount',
            'currency',
            'date',
            'vendor',
            'projectTitle',
            'status',
          ]),
        },
        create: {
          id,
          title: String(payload.title || 'Expense'),
          category: String(payload.category || 'Operations'),
          amount: Number(payload.amount) || 0,
          currency: String(payload.currency || 'USD'),
          date: String(payload.date || nowStr),
          vendor: payload.vendor ? String(payload.vendor) : null,
          projectTitle: payload.projectTitle ? String(payload.projectTitle) : null,
          status: String(payload.status || 'Approved'),
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'title',
            'category',
            'amount',
            'currency',
            'date',
            'vendor',
            'projectTitle',
            'status',
          ]),
        },
      });
      break;
    }
    case 'crmLeads': {
      await prisma.workspaceCrmLead.upsert({
        where: { id },
        update: {
          ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
          ...(payload.company !== undefined ? { company: String(payload.company) } : {}),
          ...(payload.email !== undefined ? { email: String(payload.email) } : {}),
          ...(payload.phone !== undefined ? { phone: String(payload.phone) } : {}),
          ...(payload.stage !== undefined ? { stage: String(payload.stage) } : {}),
          ...(payload.dealValue !== undefined ? { dealValue: Number(payload.dealValue) || 0 } : {}),
          ...(payload.assignedTo !== undefined ? { assignedTo: String(payload.assignedTo) } : {}),
          ...(payload.notes !== undefined ? { notes: String(payload.notes) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'name',
            'company',
            'email',
            'phone',
            'stage',
            'dealValue',
            'assignedTo',
            'notes',
          ]),
        },
        create: {
          id,
          name: String(payload.name || ''),
          company: String(payload.company || ''),
          email: String(payload.email || ''),
          phone: payload.phone ? String(payload.phone) : null,
          stage: String(payload.stage || 'New Lead'),
          dealValue: Number(payload.dealValue) || 0,
          assignedTo: payload.assignedTo ? String(payload.assignedTo) : null,
          notes: payload.notes ? String(payload.notes) : null,
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'name',
            'company',
            'email',
            'phone',
            'stage',
            'dealValue',
            'assignedTo',
            'notes',
          ]),
        },
      });
      break;
    }
    case 'supportTickets': {
      await prisma.workspaceSupportTicket.upsert({
        where: { id },
        update: {
          ...(payload.ticketNumber !== undefined ? { ticketNumber: String(payload.ticketNumber) } : {}),
          ...(payload.subject !== undefined ? { subject: String(payload.subject) } : {}),
          ...(payload.customerName !== undefined ? { customerName: String(payload.customerName) } : {}),
          ...(payload.customerEmail !== undefined ? { customerEmail: String(payload.customerEmail) } : {}),
          ...(payload.priority !== undefined ? { priority: String(payload.priority) } : {}),
          ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
          ...(payload.assignedTo !== undefined ? { assignedTo: String(payload.assignedTo) } : {}),
          ...(payload.description !== undefined ? { description: String(payload.description) } : {}),
          ...(payload.resolution !== undefined ? { resolution: String(payload.resolution) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'ticketNumber',
            'subject',
            'customerName',
            'customerEmail',
            'priority',
            'status',
            'assignedTo',
            'description',
            'resolution',
          ]),
        },
        create: {
          id,
          ticketNumber: String(payload.ticketNumber || `TKT-${Date.now().toString().slice(-6)}`),
          subject: String(payload.subject || ''),
          customerName: String(payload.customerName || ''),
          customerEmail: String(payload.customerEmail || ''),
          priority: String(payload.priority || 'Medium'),
          status: String(payload.status || 'Open'),
          assignedTo: payload.assignedTo ? String(payload.assignedTo) : null,
          description: String(payload.description || ''),
          resolution: payload.resolution ? String(payload.resolution) : null,
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'ticketNumber',
            'subject',
            'customerName',
            'customerEmail',
            'priority',
            'status',
            'assignedTo',
            'description',
            'resolution',
          ]),
        },
      });
      break;
    }
    case 'hrRecords': {
      await prisma.workspaceHrRecord.upsert({
        where: { id },
        update: {
          ...(payload.recordType !== undefined ? { recordType: String(payload.recordType) } : {}),
          ...(payload.memberName !== undefined ? { memberName: String(payload.memberName) } : {}),
          ...(payload.memberEmail !== undefined ? { memberEmail: String(payload.memberEmail) } : {}),
          ...(payload.dateOrMonth !== undefined ? { dateOrMonth: String(payload.dateOrMonth) } : {}),
          ...(payload.status !== undefined ? { status: String(payload.status) } : {}),
          ...(payload.details !== undefined ? { detailsJson: payload.details } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'recordType',
            'memberName',
            'memberEmail',
            'dateOrMonth',
            'status',
            'details',
          ]),
        },
        create: {
          id,
          recordType: String(payload.recordType || 'ATTENDANCE'),
          memberName: String(payload.memberName || ''),
          memberEmail: String(payload.memberEmail || ''),
          dateOrMonth: String(payload.dateOrMonth || nowStr),
          status: String(payload.status || 'Present'),
          detailsJson: payload.details && typeof payload.details === 'object' ? payload.details : {},
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'recordType',
            'memberName',
            'memberEmail',
            'dateOrMonth',
            'status',
            'details',
          ]),
        },
      });
      break;
    }
    case 'chatChannels': {
      await prisma.workspaceChatChannel.upsert({
        where: { id },
        update: {
          ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
          ...(payload.description !== undefined ? { description: String(payload.description) } : {}),
          ...(payload.channelType !== undefined ? { channelType: String(payload.channelType) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra(['name', 'description', 'channelType']),
        },
        create: {
          id,
          name: String(payload.name || 'general'),
          description: payload.description ? String(payload.description) : null,
          channelType: String(payload.channelType || 'PUBLIC'),
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra(['name', 'description', 'channelType']),
        },
      });
      break;
    }
    case 'chatMessages': {
      await prisma.workspaceChatMessage.upsert({
        where: { id },
        update: {
          ...(payload.channelId !== undefined ? { channelId: String(payload.channelId) } : {}),
          ...(payload.senderName !== undefined ? { senderName: String(payload.senderName) } : {}),
          ...(payload.senderEmail !== undefined ? { senderEmail: String(payload.senderEmail) } : {}),
          ...(payload.text !== undefined ? { text: String(payload.text) } : {}),
          ...(payload.isPinned !== undefined ? { isPinned: Boolean(payload.isPinned) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra(['channelId', 'senderName', 'senderEmail', 'text', 'isPinned']),
        },
        create: {
          id,
          channelId: String(payload.channelId || ''),
          senderName: String(payload.senderName || 'Administrator'),
          senderEmail: String(payload.senderEmail || 'zayed.islam1998@gmail.com'),
          text: String(payload.text || ''),
          isPinned: Boolean(payload.isPinned),
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra(['channelId', 'senderName', 'senderEmail', 'text', 'isPinned']),
        },
      });
      break;
    }
    case 'wikiArticles': {
      await prisma.workspaceWikiArticle.upsert({
        where: { id },
        update: {
          ...(payload.title !== undefined ? { title: String(payload.title) } : {}),
          ...(payload.category !== undefined ? { category: String(payload.category) } : {}),
          ...(payload.summary !== undefined ? { summary: String(payload.summary) } : {}),
          ...(payload.content !== undefined ? { content: String(payload.content) } : {}),
          ...(payload.authorName !== undefined ? { authorName: String(payload.authorName) } : {}),
          ...(payload.isPinned !== undefined ? { isPinned: Boolean(payload.isPinned) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'title',
            'category',
            'summary',
            'content',
            'authorName',
            'isPinned',
          ]),
        },
        create: {
          id,
          title: String(payload.title || 'Untitled Article'),
          category: String(payload.category || 'SOP & Guidelines'),
          summary: payload.summary ? String(payload.summary) : null,
          content: String(payload.content || ''),
          authorName: String(payload.authorName || 'Administrator'),
          isPinned: Boolean(payload.isPinned),
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'title',
            'category',
            'summary',
            'content',
            'authorName',
            'isPinned',
          ]),
        },
      });
      break;
    }
    case 'automationRules': {
      await prisma.workspaceAutomationRule.upsert({
        where: { id },
        update: {
          ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
          ...(payload.triggerEvent !== undefined ? { triggerEvent: String(payload.triggerEvent) } : {}),
          ...(payload.actionType !== undefined ? { actionType: String(payload.actionType) } : {}),
          ...(payload.targetValue !== undefined ? { targetValue: String(payload.targetValue) } : {}),
          ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
          ...(payload.runsCount !== undefined ? { runsCount: Number(payload.runsCount) || 0 } : {}),
          ...(payload.lastRunAt !== undefined ? { lastRunAt: String(payload.lastRunAt) } : {}),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'name',
            'triggerEvent',
            'actionType',
            'targetValue',
            'isActive',
            'runsCount',
            'lastRunAt',
          ]),
        },
        create: {
          id,
          name: String(payload.name || 'Untitled Rule'),
          triggerEvent: String(payload.triggerEvent || ''),
          actionType: String(payload.actionType || ''),
          targetValue: String(payload.targetValue || ''),
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
          runsCount: Number(payload.runsCount) || 0,
          lastRunAt: payload.lastRunAt ? String(payload.lastRunAt) : null,
          createdAt: String(payload.createdAt || nowStr),
          updatedAt: nowStr,
          timestampMs: ts,
          extraFields: extractExtra([
            'name',
            'triggerEvent',
            'actionType',
            'targetValue',
            'isActive',
            'runsCount',
            'lastRunAt',
          ]),
        },
      });
      break;
    }
  }

  const items = await listEngineRecords(col);
  const item = items.find((i) => i.id === id) || items[0];
  return { item, items };
}

export async function deleteEngineRecordInDb(
  col: EngineCollectionKey,
  id: string
): Promise<any[]> {
  switch (col) {
    case 'sheets':
      await prisma.workspaceSheet.deleteMany({ where: { id } });
      break;
    case 'calendarEvents':
      await prisma.workspaceCalendarEvent.deleteMany({ where: { id } });
      break;
    case 'invoices':
      await prisma.workspaceInvoice.deleteMany({ where: { id } });
      break;
    case 'expenses':
      await prisma.workspaceExpense.deleteMany({ where: { id } });
      break;
    case 'crmLeads':
      await prisma.workspaceCrmLead.deleteMany({ where: { id } });
      break;
    case 'supportTickets':
      await prisma.workspaceSupportTicket.deleteMany({ where: { id } });
      break;
    case 'hrRecords':
      await prisma.workspaceHrRecord.deleteMany({ where: { id } });
      break;
    case 'chatChannels':
      await prisma.workspaceChatChannel.deleteMany({ where: { id } });
      break;
    case 'chatMessages':
      await prisma.workspaceChatMessage.deleteMany({ where: { id } });
      break;
    case 'wikiArticles':
      await prisma.workspaceWikiArticle.deleteMany({ where: { id } });
      break;
    case 'automationRules':
      await prisma.workspaceAutomationRule.deleteMany({ where: { id } });
      break;
  }
  return listEngineRecords(col);
}
