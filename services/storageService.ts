import { openDB, DBSchema } from 'idb';
import { ProcessingJob, OCRItem } from '../types';

interface FAXOCRDB extends DBSchema {
  jobs: {
    key: string;
    value: ProcessingJob;
  };
  items: {
    key: string;
    value: OCRItem; // Note: sourceImageUrl (blob url) cannot be stored directly
  };
  page_images: {
    key: string; // format: jobId_pageIndex
    value: Blob;
  };
}

const DB_NAME = 'hokkaido_sanki_ocr_db';
const DB_VERSION = 1;

// Initialize DB
const getDB = async () => {
  return openDB<FAXOCRDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('jobs')) {
        db.createObjectStore('jobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('page_images')) {
        db.createObjectStore('page_images');
      }
    },
  });
};

export const storageService = {
  async saveJob(job: ProcessingJob) {
    const db = await getDB();
    await db.put('jobs', job);
  },

  async saveJobs(jobs: ProcessingJob[]) {
    const db = await getDB();
    const tx = db.transaction('jobs', 'readwrite');
    await Promise.all(jobs.map(job => tx.store.put(job)));
    await tx.done;
  },

  async deleteJob(jobId: string) {
    const db = await getDB();
    await db.delete('jobs', jobId);
    
    // Also delete associated items and images
    const allItems = await db.getAll('items');
    const jobItems = allItems.filter(i => i.jobId === jobId);
    
    const tx = db.transaction(['items', 'page_images'], 'readwrite');
    // Delete items
    for (const item of jobItems) {
      tx.objectStore('items').delete(item.id);
    }
    
    // Delete images (we need to find keys starting with jobId)
    // IDB key range scan is better but for simplicity:
    const allImageKeys = await db.getAllKeys('page_images');
    for (const key of allImageKeys) {
      if (key.toString().startsWith(`${jobId}_`)) {
        tx.objectStore('page_images').delete(key);
      }
    }
    
    await tx.done;
  },

  async saveItem(item: OCRItem) {
    const db = await getDB();
    // Remove blob URL before saving as it's not persistent
    const { sourceImageUrl, ...itemToSave } = item;
    await db.put('items', itemToSave as OCRItem);
  },

  async saveItems(items: OCRItem[]) {
    const db = await getDB();
    const tx = db.transaction('items', 'readwrite');
    for (const item of items) {
      const { sourceImageUrl, ...itemToSave } = item;
      tx.store.put(itemToSave as OCRItem);
    }
    await tx.done;
  },

  async deleteItemsByJobId(jobId: string) {
    const db = await getDB();
    const allItems = await db.getAll('items');
    const tx = db.transaction('items', 'readwrite');
    allItems.filter(i => i.jobId === jobId).forEach(item => {
        tx.store.delete(item.id);
    });
    await tx.done;
  },

  async deleteItemsByIds(ids: string[]) {
    const db = await getDB();
    const tx = db.transaction('items', 'readwrite');
    for (const id of ids) {
      tx.store.delete(id);
    }
    await tx.done;
  },

  async savePageImage(jobId: string, pageIndex: number, blob: Blob) {
    const db = await getDB();
    await db.put('page_images', blob, `${jobId}_${pageIndex}`);
  },

  async getPageImage(jobId: string, pageIndex: number): Promise<Blob | undefined> {
    const db = await getDB();
    return db.get('page_images', `${jobId}_${pageIndex}`);
  },

  async loadAllData() {
    const db = await getDB();
    const jobs = await db.getAll('jobs');
    const storedItems = await db.getAll('items');

    // Reconstruct items with blob URLs
    const items: OCRItem[] = [];
    
    for (const item of storedItems) {
      if (item.jobId && item.pageNumber !== undefined) {
        // In App.tsx we save with index (0-based). item.pageNumber is (i+1).
        // So we look for key `${item.jobId}_${item.pageNumber - 1}`
        const blob = await db.get('page_images', `${item.jobId}_${item.pageNumber - 1}`);
        if (blob) {
          items.push({
            ...item,
            sourceImageUrl: URL.createObjectURL(blob)
          });
        } else {
          // Image lost? keep item but no image
          items.push(item);
        }
      } else {
        items.push(item);
      }
    }

    return { jobs, items };
  },
  
  async clearAll() {
      const db = await getDB();
      await db.clear('jobs');
      await db.clear('items');
      await db.clear('page_images');
  }
};