/**
 * Copyright (c) 2000-present Liferay, Inc. All rights reserved.
 *
 * This library is free software; you can redistribute it and/or modify it under
 * the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation; either version 2.1 of the License, or (at your option)
 * any later version.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 */

import ServiceProvider from '../../ServiceProvider/index';
import {CURRENT_ORDER_UPDATED} from '../../utilities/eventsDefinitions';

const CartResource = ServiceProvider.DeliveryCartAPI('v1');

function formatCartItem(
	cpInstance,
	namespace,
	skuOptions,
	skuOptionsNamespace
) {
	let optionsJSON = cpInstance.skuOptions || [];

	if (namespace && skuOptionsNamespace && namespace === skuOptionsNamespace) {
		optionsJSON = skuOptions;
	}
	else if (optionsJSON.length > 0) {
		optionsJSON = optionsJSON.map((optionJSON) => ({
			...optionJSON,
			value: optionJSON.skuOptionValueKey,
		}));
	}

	return {
		options: JSON.stringify(optionsJSON),
		quantity: cpInstance.quantity,
		skuId: cpInstance.skuId,
	};
}

export async function addToCart(
	cpInstances,
	cartId,
	channel,
	accountId,
	orderTypeId,
	namespace,
	skuOptions,
	skuOptionsNamespace
) {
	if (!cartId) {
		const newCart = await CartResource.createCartByChannelId(channel.id, {
			accountId,
			cartItems: cpInstances.map((cpInstance) =>
				formatCartItem(
					cpInstance,
					namespace,
					skuOptions,
					skuOptionsNamespace
				)
			),
			currencyCode: channel.currencyCode,
			orderTypeId,
		});

		Liferay.fire(CURRENT_ORDER_UPDATED, {order: newCart});

		return newCart;
	}

	const fetchedCart = await CartResource.getCartByIdWithItems(cartId);

	const updatedCartItems = fetchedCart.cartItems;

	cpInstances.forEach((cpInstance) => {
		const includedCartItem = updatedCartItems.find((cartItem) => {
			const optionsJSON = JSON.parse(cartItem.options);

			let includedCartItem = cartItem.skuId === cpInstance.skuId;

			if (includedCartItem) {
				optionsJSON.forEach((optionJSON) => {
					if (!includedCartItem) {
						return;
					}

					const currentSkuOption = cpInstance.skuOptions?.find(
						(skuOption) =>
							optionJSON.skuOptionKey === skuOption.skuOptionKey
					);

					currentSkuOption
						? (includedCartItem =
								optionJSON.skuOptionValueKey ===
								currentSkuOption.skuOptionValueKey)
						: (includedCartItem = false);
				});
			}

			return includedCartItem;
		});

		if (includedCartItem) {
			includedCartItem.quantity += cpInstance.quantity;
		}
		else {
			updatedCartItems.push(
				formatCartItem(
					cpInstance,
					namespace,
					skuOptions,
					skuOptionsNamespace
				)
			);
		}
	});

	const updatedCart = await CartResource.updateCartById(cartId, {
		cartItems: updatedCartItems,
	});

	Liferay.fire(CURRENT_ORDER_UPDATED, {order: updatedCart});

	return updatedCart;
}
