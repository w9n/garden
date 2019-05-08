/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import React from "react"
import { css } from "emotion"
import styled from "@emotion/styled"
import { ReactComponent as VIcon } from "./../assets/v.svg"
import Ingresses from "./ingresses"
import { ServiceModel } from "../containers/overview"
import { ServiceState } from "garden-cli/src/types/service"
import { colors } from "../styles/variables"
import { Facebook } from "react-content-loader"

const Service = styled.div`
  width: 18rem;
  height: 13rem;
  background-color: white;
  margin-right: 1rem;
  box-shadow: 0px 0px 16px rgba(0, 0, 0, 0.14);
  border-radius: 4px;

  &:last-of-type {
    margin-right: 0;
  }
`
const Header = styled.div`
  width: 100%;
  padding: .6rem .75rem;
  border-bottom: 1px solid #c4c4c4;
  height: 3rem;
`

const Fields = styled.div`
 animation: fadein .75s;

  @keyframes fadein {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`
const Field = styled.div`
  padding-bottom: .5rem;
  max-width: 17rem;
`

const Key = styled.div`
  padding-right: .5rem;
  font-size: 13px;
  line-height: 19px;
  letter-spacing: 0.01em;
  color: #4C5862;
  opacity: 0.5;
`

const Value = styled.div`
  font-size: 13px;
  line-height: 19px;
  letter-spacing: 0.01em;
  color: #4C5862;
`

const Content = styled.div`
  width: 100%;
  padding: .75rem .75rem .75rem .75rem;
  position: relative;
  height: 10rem;
`

type StateProps = {
  state?: ServiceState,
}
const State = styled.div<StateProps>`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 2rem;
  margin-left: auto;
  background-color: ${props => (props && props.state && colors.status[props.state] || colors.gardenGrayLight)};
  display: flex;
  align-items: center;
  margin-top: -0.5rem;
`

const Tag = styled.div`
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: 10px;
  line-height: 10px;
  text-align: right;
  letter-spacing: 0.01em;
  color: #90A0B7;
`
const Name = styled.div`
  height: 1rem;
  font-size: 0.9375rem;
  color: rgba(0, 0, 0, .87);
`

const Row = styled.div`
  display: flex;
  align-items: center;
`

interface ServiceProp {
  service: ServiceModel
  className?: string
}

export default ({
  service: { name, ingresses, state, isLoading },
  className,
}: ServiceProp) => {

  return (
    <Service className={className}>
      <Header>
        <Tag>SERVICE</Tag>
        <Row>
          <Name>{name}</Name>
          <State state={state}>
            <VIcon className={`${css("margin: 0 auto;")}`} />
          </State>
        </Row>
      </Header>
      <Content>
        {isLoading && (
          <Facebook height={300} />
        )}
        {!isLoading && (
          <Fields>
            <Field>
              <Key>State</Key>
              <Value>{state}</Value>
            </Field>
            <Field>
              <Key>Ingresses</Key>
              <Ingresses ingresses={ingresses} />
            </Field>
          </Fields>
        )}
      </Content>

    </Service>
  )
}
