import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@ctrb_app_db:';

const SEED_RECORDS = [
  {
    id: 'ctrb_seed_1',
    ctrb_number: 'TIM-9831A',
    job_id: 'JOB-2026-001',
    make: 'TIM',
    date_received: '2026-06-20',
    status: 'under_inspection',
  },
  {
    id: 'ctrb_seed_2',
    ctrb_number: 'SKF-4512B',
    job_id: 'JOB-2026-002',
    make: 'SKF',
    date_received: '2026-06-22',
    status: 'received',
  },
  {
    id: 'ctrb_seed_3',
    ctrb_number: 'TIM-1122C',
    job_id: 'JOB-2026-003',
    make: 'TIM',
    date_received: '2026-06-25',
    status: 'assembly',
  },
];

// Helper to seed database if empty
async function initializeDatabase() {
  try {
    const dataStr = await AsyncStorage.getItem(STORAGE_PREFIX + 'ctrb_records');
    if (!dataStr || JSON.parse(dataStr).length === 0) {
      await AsyncStorage.setItem(STORAGE_PREFIX + 'ctrb_records', JSON.stringify(SEED_RECORDS));
      console.log('Seeded database with default records');
    }
  } catch (err) {
    console.error('Failed to initialize local mock database:', err);
  }
}

// Run initialization
initializeDatabase();

class Record {
  constructor(tableName, data) {
    this._tableName = tableName;
    Object.assign(this, data);
  }

  async update(modifier) {
    if (typeof modifier === 'function') {
      modifier(this);
    }
    try {
      const dataStr = await AsyncStorage.getItem(STORAGE_PREFIX + this._tableName);
      const data = dataStr ? JSON.parse(dataStr) : [];
      const index = data.findIndex(item => item.id === this.id);
      if (index !== -1) {
        const serialized = { ...this };
        delete serialized._tableName;
        data[index] = serialized;
        await AsyncStorage.setItem(STORAGE_PREFIX + this._tableName, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`Failed to update record in ${this._tableName}:`, err);
    }
    return this;
  }

  async destroyPermanently() {
    try {
      const dataStr = await AsyncStorage.getItem(STORAGE_PREFIX + this._tableName);
      const data = dataStr ? JSON.parse(dataStr) : [];
      const index = data.findIndex(item => item.id === this.id);
      if (index !== -1) {
        data.splice(index, 1);
        await AsyncStorage.setItem(STORAGE_PREFIX + this._tableName, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`Failed to delete record in ${this._tableName}:`, err);
    }
  }
}

class Query {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async fetch() {
    try {
      const dataStr = await AsyncStorage.getItem(STORAGE_PREFIX + this.tableName);
      const data = dataStr ? JSON.parse(dataStr) : [];
      return data.map(item => new Record(this.tableName, item));
    } catch (err) {
      console.error(`Failed to fetch query for ${this.tableName}:`, err);
      return [];
    }
  }
}

class Collection {
  constructor(tableName) {
    this.tableName = tableName;
  }

  query() {
    return new Query(this.tableName);
  }

  async find(id) {
    try {
      const dataStr = await AsyncStorage.getItem(STORAGE_PREFIX + this.tableName);
      const data = dataStr ? JSON.parse(dataStr) : [];
      const record = data.find(item => item.id === id);
      if (!record) {
        throw new Error(`Record ${id} not found in ${this.tableName}`);
      }
      return new Record(this.tableName, record);
    } catch (err) {
      console.error(`Error in find for ${this.tableName}:`, err);
      throw err;
    }
  }

  async create(modifier) {
    try {
      const dataStr = await AsyncStorage.getItem(STORAGE_PREFIX + this.tableName);
      const data = dataStr ? JSON.parse(dataStr) : [];
      
      const newRecordData = {
        id: Math.random().toString(36).substring(2, 15) + '_' + Date.now(),
      };
      const record = new Record(this.tableName, newRecordData);
      if (typeof modifier === 'function') {
        modifier(record);
      }
      
      const serialized = { ...record };
      delete serialized._tableName;
      
      data.push(serialized);
      await AsyncStorage.setItem(STORAGE_PREFIX + this.tableName, JSON.stringify(data));
      return record;
    } catch (err) {
      console.error(`Failed to create record in ${this.tableName}:`, err);
      throw err;
    }
  }
}

export const database = {
  collections: {
    get(tableName) {
      return new Collection(tableName);
    }
  },
  async write(work) {
    if (typeof work === 'function') {
      return await work();
    }
  }
};
