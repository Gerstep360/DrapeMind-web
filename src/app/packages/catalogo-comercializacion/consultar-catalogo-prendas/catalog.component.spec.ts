import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { CatalogComponent } from './catalog.component';
import { CatalogApiService } from '@core/api/catalog-api.service';
import { ReservationsApiService } from '@core/api/reservations-api.service';
import { AuthService } from '@core/auth.service';
import { BranchService } from '@core/branch.service';
import { CartService } from '@core/cart.service';
import { ToastService } from '@core/toast.service';
import { Product } from '@core/models';

describe('Storefront catalog requests', () => {
  let component: CatalogComponent;
  let requests: Subject<Product[]>[];
  beforeEach(() => {
    requests = [];
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        {
          provide: CatalogApiService,
          useValue: {
            products: () => {
              const request = new Subject<Product[]>();
              requests.push(request);
              return request;
            },
            categories: () => of([]),
            favorites: () => throwError(() => new Error('Favorites unavailable')),
          },
        },
        {
          provide: BranchService,
          useValue: {
            loadBranches: () => undefined,
            branches: signal([]),
            selectedBranch: signal(null),
          },
        },
        { provide: AuthService, useValue: { user: signal({ rol: 'CLIENTE' }) } },
        { provide: CartService, useValue: {} },
        { provide: ReservationsApiService, useValue: {} },
        { provide: ToastService, useValue: { show: () => undefined } },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new CatalogComponent());
  });

  it('keeps the latest filter result when an earlier request finishes late', () => {
    component.chooseGender('MUJER');
    requests[1].next([{ id: 2 } as Product]);
    requests[0].next([{ id: 1 } as Product]);
    expect(component.products().map((p) => p.id)).toEqual([2]);
    expect(component.loading()).toBe(false);
  });

  it('offers retry after a catalog failure while favorites failures stay independent', () => {
    requests[0].error(new Error('Catalog offline'));
    expect(component.catalogError()).toBeTruthy();
    component.loadProducts();
    requests[1].next([{ id: 3 } as Product]);
    expect(component.catalogError()).toBeNull();
    expect(component.products()[0].id).toBe(3);
  });
});
