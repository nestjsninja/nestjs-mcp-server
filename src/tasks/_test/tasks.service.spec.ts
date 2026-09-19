import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from '../tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService();
  });

  it('returns every task with no filter', () => {
    assert.equal(service.findAll().length, 3);
  });

  it('filters by status and by assignee', () => {
    assert.equal(service.findAll({ status: 'open' }).length, 2);
    assert.equal(service.findAll({ assignee: 'ana' }).length, 1);
    assert.equal(service.findAll({ status: 'open', assignee: 'ana' }).length, 0);
  });

  it('closes a task', () => {
    assert.equal(service.close('T-1').status, 'done');
    assert.equal(service.findAll({ status: 'open' }).length, 1);
  });

  it('throws a domain exception for an unknown id', () => {
    assert.throws(() => service.findOne('NOPE'), NotFoundException);
    assert.throws(() => service.findOne('NOPE'), /Task NOPE does not exist/);
  });
});
